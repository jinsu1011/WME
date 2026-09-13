"""정렬 실습(alignment) 분석기 — 규칙 기반. 모델 학습을 하지 않는다.

입력은 measurements 의 화면 웨이퍼 상태(wafer_x, wafer_y, wafer_theta) 시계열이고,
출력은 events(보정 구간·과잉 보정 구간)와 attempts.summary_json 이다.
이 출력이 그대로 LLM 피드백의 입력이 된다.

좌표 약속
  wafer_x, wafer_y : 마스크 마크 기준 상대 위치(px). 목표는 0
  wafer_theta      : 회전(도). 목표는 0
  따라서 각 축의 값이 곧 "남은 오차"다.

허용 오차는 과정 설정값이지 실제 장비의 정렬 정밀도가 아니다.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

# --- 분석 설정값 (과정 설정값이다. 장비 사양이 아니다) ---------------------
DEFAULT_TOLERANCE = {"position_px": 4.0, "rotation_deg": 1.0}

# 이 속도보다 느린 변화는 손떨림·센서 잡음으로 보고 보정 동작으로 세지 않는다.
# 샘플 간 변화량이 아니라 "초당 변화량"으로 판정한다.
# (샘플 간 변화량으로 하면 천천히 움직인 보정이 통째로 누락된다 — 실제로 확인한 문제다)
MOTION_SPEED_PX_S = 2.0       # 초당 위치 변화량 하한
MOTION_SPEED_DEG_S = 0.4      # 초당 회전 변화량 하한
# 속도는 샘플 하나가 아니라 이 길이의 창으로 잰다.
# 50Hz 에서 샘플 간격은 20ms 라서, 창이 없으면 손떨림 잡음이 초당 환산되며
# 움직임으로 잡히고 보정 구간이 전부 하나로 뭉친다 — 실제로 확인한 문제다.
MOTION_WINDOW_MS = 200
# 보정 구간 사이의 짧은 정지는 같은 구간으로 묶는다.
# 창 길이(아래 MOTION_WINDOW_MS)만큼 뒤로 번지므로, 실제로는 약 450ms 보다 긴 정지에서 나뉜다.
SEGMENT_GAP_MS = 250
# 너무 짧은 움직임은 구간으로 만들지 않는다.
MIN_SEGMENT_MS = 150
# 과잉 보정 판정: 목표(0)를 지나친 뒤 반대쪽으로 이 정도는 벗어나야 인정한다.
OVERSHOOT_BAND = {"x": 2.0, "y": 2.0, "theta": 0.5}   # px, px, deg
# 축 간섭 판정: 주축 대비 부축의 정규화된 변화 비율이 이 값을 넘으면 간섭으로 본다.
INTERFERENCE_RATIO = 0.45

AXES = ("x", "y", "theta")


@dataclass
class Sample:
    t_ms: int
    x: float
    y: float
    theta: float

    def axis(self, name: str) -> float:
        return getattr(self, "theta" if name == "theta" else name)


@dataclass
class AnalyzedEvent:
    id: str
    start_ms: int
    end_ms: int
    type: str                       # 'adjustment' | 'overshoot'
    metrics: dict[str, Any] = field(default_factory=dict)


@dataclass
class AnalysisResult:
    summary: dict[str, Any]
    events: list[AnalyzedEvent]


# --- 유틸 ----------------------------------------------------------------

def to_samples(rows: Iterable[Any]) -> list[Sample]:
    """sqlite Row / dict / 튜플 어느 쪽이든 Sample 로 바꾼다."""
    out: list[Sample] = []
    for r in rows:
        if isinstance(r, Sample):
            out.append(r)
            continue
        get = r.__getitem__ if hasattr(r, "keys") else None
        if get is not None:
            out.append(Sample(int(r["t_ms"]), float(r["wafer_x"]), float(r["wafer_y"]),
                              float(r["wafer_theta"])))
        else:
            t, x, y, th = r
            out.append(Sample(int(t), float(x), float(y), float(th)))
    out.sort(key=lambda s: s.t_ms)
    return out


def _norm(axis: str, value: float, tol: dict[str, float]) -> float:
    """축마다 단위가 달라서 허용 오차로 나눠 비교 가능한 값으로 만든다."""
    limit = tol["rotation_deg"] if axis == "theta" else tol["position_px"]
    return abs(value) / limit if limit else abs(value)


def _position_error(s: Sample) -> float:
    return math.hypot(s.x, s.y)


# --- 1) 보정 구간 찾기 -----------------------------------------------------

def find_adjustment_segments(samples: Sequence[Sample]) -> list[tuple[int, int]]:
    """움직임이 있는 구간의 (시작 인덱스, 끝 인덱스) 목록. 짧은 정지는 이어 붙인다."""
    if len(samples) < 2:
        return []
    moving: list[bool] = [False] * len(samples)
    j = 0
    for i in range(1, len(samples)):
        while j + 1 < i and samples[i].t_ms - samples[j + 1].t_ms >= MOTION_WINDOW_MS:
            j += 1
        a, b = samples[j], samples[i]
        dt_s = (b.t_ms - a.t_ms) / 1000.0
        if dt_s <= 0:
            continue
        pos_speed = math.hypot(b.x - a.x, b.y - a.y) / dt_s
        rot_speed = abs(b.theta - a.theta) / dt_s
        if pos_speed >= MOTION_SPEED_PX_S or rot_speed >= MOTION_SPEED_DEG_S:
            # 창의 끝 샘플만 표시한다. 창 전체를 표시하면 움직임이 앞뒤로 번져서
            # 사이의 정지가 지워지고 보정 구간이 전부 하나로 붙는다 — 실제로 확인한 문제다.
            moving[i] = True

    segments: list[list[int]] = []
    i = 0
    while i < len(samples):
        if not moving[i]:
            i += 1
            continue
        j = i
        while j + 1 < len(samples) and moving[j + 1]:
            j += 1
        if segments and samples[i].t_ms - samples[segments[-1][1]].t_ms <= SEGMENT_GAP_MS:
            segments[-1][1] = j           # 짧은 정지 → 같은 보정 동작으로 본다
        else:
            segments.append([i, j])
        i = j + 1

    return [(a, b) for a, b in segments
            if samples[b].t_ms - samples[a].t_ms >= MIN_SEGMENT_MS]


def segment_metrics(samples: Sequence[Sample], a: int, b: int,
                    tol: dict[str, float]) -> dict[str, Any]:
    """한 보정 구간에서 어떤 축을 얼마나 움직였는지, 축 간섭이 있었는지."""
    moved = {ax: abs(samples[b].axis(ax) - samples[a].axis(ax)) for ax in AXES}
    normed = {ax: _norm(ax, moved[ax], tol) for ax in AXES}
    dominant = max(normed, key=lambda k: normed[k])
    top = normed[dominant]
    others = {ax: v for ax, v in normed.items() if ax != dominant}
    second = max(others, key=lambda k: others[k]) if others else None
    ratio = (others[second] / top) if (second and top > 0) else 0.0

    before = _position_error(samples[a])
    after = _position_error(samples[b])
    # 프론트 AlignmentEvent 는 축을 'xy' / 'theta' 두 가지로만 본다.
    axis = "theta" if dominant == "theta" else "xy"
    if axis == "theta":
        err_before, err_after = abs(samples[a].theta), abs(samples[b].theta)
    else:
        err_before, err_after = before, after
    return {
        "axis": axis,
        "errorBefore": round(err_before, 3),
        "errorAfter": round(err_after, 3),
        "dominantAxis": dominant,
        "movedX": round(samples[b].x - samples[a].x, 3),
        "movedY": round(samples[b].y - samples[a].y, 3),
        "movedTheta": round(samples[b].theta - samples[a].theta, 3),
        "posErrorBefore": round(before, 3),
        "posErrorAfter": round(after, 3),
        "thetaErrorBefore": round(abs(samples[a].theta), 3),
        "thetaErrorAfter": round(abs(samples[b].theta), 3),
        # 축 간섭: 한 축을 맞추는 동안 다른 축이 함께 흔들렸는가
        "axisInterference": round(ratio, 3),
        "axisInterferenceFlag": bool(second and ratio >= INTERFERENCE_RATIO),
        "secondaryAxis": second,
        "improved": bool(after + 1e-9 < before or abs(samples[b].theta) + 1e-9 < abs(samples[a].theta)),
    }


# --- 2) 과잉 보정 찾기 -----------------------------------------------------

def find_overshoots(samples: Sequence[Sample]) -> list[dict[str, Any]]:
    """축별로 목표(0)를 지나쳤다가 되돌아온 지점.

    판정: 부호가 바뀌고(목표 통과), 반대쪽으로 OVERSHOOT_BAND 이상 벗어났다가
    다시 0 쪽으로 돌아오면 과잉 보정 1회로 센다.
    """
    found: list[dict[str, Any]] = []
    for ax in AXES:
        band = OVERSHOOT_BAND[ax]
        values = [s.axis(ax) for s in samples]
        cross_idx: int | None = None
        peak_idx: int | None = None
        peak_val = 0.0
        for i in range(1, len(values)):
            prev, cur = values[i - 1], values[i]
            crossed = (prev > 0 > cur) or (prev < 0 < cur)
            if crossed:
                # 이전 통과 건이 아직 안 닫혔으면 버린다(되돌아온 것으로 확정 못 함)
                cross_idx, peak_idx, peak_val = i, i, 0.0
                continue
            if cross_idx is None:
                continue
            if abs(cur) > abs(peak_val):
                peak_val, peak_idx = cur, i
            # 되돌아오기 시작했고, 벗어난 양이 밴드를 넘었으면 과잉 보정으로 확정
            if abs(peak_val) >= band and abs(cur) < abs(peak_val) * 0.6:
                found.append({
                    "axis": "theta" if ax == "theta" else "xy",
                    "movedAxis": ax,
                    "start_ms": samples[cross_idx].t_ms,
                    "end_ms": samples[i].t_ms,
                    "peak_ms": samples[peak_idx or i].t_ms,
                    "errorBefore": round(abs(values[cross_idx]), 3),
                    "errorAfter": round(abs(cur), 3),
                    "overshootAmount": round(abs(peak_val), 3),
                    "unit": "deg" if ax == "theta" else "px",
                })
                cross_idx, peak_idx, peak_val = None, None, 0.0
    found.sort(key=lambda e: e["start_ms"])
    return found


# --- 3) 수렴 패턴 ---------------------------------------------------------

def convergence_pattern(samples: Sequence[Sample], tol: dict[str, float]) -> dict[str, Any]:
    """언제 허용 오차 안에 들어왔는지, 위치와 회전 중 무엇을 먼저 정리했는지."""
    pos_tol, rot_tol = tol["position_px"], tol["rotation_deg"]

    def settle_time(pred) -> int | None:
        """마지막으로 조건을 만족하기 시작한 시각(그 뒤로 계속 만족)."""
        last_bad = None
        for s in samples:
            if not pred(s):
                last_bad = s.t_ms
        if last_bad is None:
            return samples[0].t_ms if samples else None
        for s in samples:
            if s.t_ms > last_bad:
                return s.t_ms
        return None                      # 끝까지 못 들어옴

    pos_settled = settle_time(lambda s: _position_error(s) <= pos_tol)
    rot_settled = settle_time(lambda s: abs(s.theta) <= rot_tol)

    if pos_settled is None or rot_settled is None:
        order = "not_converged"
    elif abs(pos_settled - rot_settled) <= 500:
        order = "together"
    elif pos_settled < rot_settled:
        order = "position_first"
    else:
        order = "rotation_first"

    # 단조 수렴도: 전체 오차(정규화)가 줄어든 구간의 비율
    improving = total = 0
    for i in range(1, len(samples)):
        prev = _norm("x", samples[i - 1].x, tol) + _norm("y", samples[i - 1].y, tol) \
            + _norm("theta", samples[i - 1].theta, tol)
        cur = _norm("x", samples[i].x, tol) + _norm("y", samples[i].y, tol) \
            + _norm("theta", samples[i].theta, tol)
        if abs(cur - prev) < 1e-6:
            continue
        total += 1
        if cur < prev:
            improving += 1
    monotonic = round(improving / total, 3) if total else 1.0

    return {
        "order": order,
        "positionSettledMs": pos_settled,
        "rotationSettledMs": rot_settled,
        "monotonicRatio": monotonic,
    }


# --- 채점기에 넘길 지표 ---------------------------------------------------
# 허용 오차의 몇 %까지를 "여유 있다"로 볼지. 채점 기준값 자체는 과정 데이터에 있고,
# 여기서는 그 판정에 필요한 불리언만 만든다.
COMFORT_RATIO = 0.6
OUT_OF_RANGE_RATIO = 2.5


def scoring_metrics(last: Sample, tol: dict[str, float], events: Sequence[AnalyzedEvent],
                    pattern: dict[str, Any], interference: Sequence[str]) -> dict[str, Any]:
    """실습유형_설계.md 4절의 scoring_metrics.

    답변에서 나오는 지표(answerLength, reportedOrderMismatch)는 제출 시점에
    answer_metrics() 로 덮어쓴다. 여기서는 기본값을 넣어 모양을 맞춰 둔다.
    """
    pos_tol = tol.get("position_px", 4.0)
    rot_tol = tol.get("rotation_deg", 1.0)
    pos_err = _position_error(last)
    rot_err = abs(last.theta)
    return {
        "finalPositionError": round(pos_err, 3),
        "finalRotationError": round(rot_err, 3),
        "overshootCount": sum(1 for e in events if e.type == "overshoot"),
        "convergenceOrder": pattern.get("order", "unknown"),
        "axisInterference": bool(interference),
        "converged": pos_err <= pos_tol and rot_err <= rot_tol,
        # 위치 기준 점수에 회전을 반영하기 위한 불리언(설계서 6절 "회전은 modifier")
        "rotationOutsideComfort": rot_err > rot_tol * COMFORT_RATIO,
        "rotationOutsideRange": rot_err > rot_tol * OUT_OF_RANGE_RATIO,
        # 아래 둘은 제출 시점에 채워진다
        "reportedOrderMismatch": False,
        "answerLength": 0,
    }


# 분석이 내는 수렴 패턴 ↔ 학습자가 고르는 선택지의 id
ORDER_FROM_PATTERN = {
    "position_first": "xy-then-theta",
    "rotation_first": "theta-then-xy",
    "together": "interleaved",
    "not_converged": "unknown",
}


def answer_metrics(summary: dict[str, Any], answer: dict[str, Any]) -> dict[str, Any]:
    """제출된 답변에서 나오는 지표. 이 유형(정렬 실습)의 답변 형태를 아는 곳이다."""
    observed = ORDER_FROM_PATTERN.get(
        summary.get("path_analysis", {}).get("convergence", {}).get("order", ""), "unknown")
    reported = answer.get("orderOptionId")
    mismatch = bool(reported and reported != "other"
                    and observed != "unknown" and reported != observed)
    return {
        "reportedOrderMismatch": mismatch,
        "answerLength": len((answer.get("reason") or "").strip()),
        "observedOrderOptionId": observed,
    }

# --- 4) 전체 분석 ---------------------------------------------------------

def analyze(samples_in: Iterable[Any], tolerance: dict[str, float] | None = None,
            event_prefix: str = "ev") -> AnalysisResult:
    tol = {**DEFAULT_TOLERANCE, **(tolerance or {})}
    samples = to_samples(samples_in)
    if not samples:
        raise ValueError("측정 샘플이 없습니다. 분석할 수 없습니다.")

    last = samples[-1]
    duration_ms = last.t_ms - samples[0].t_ms

    events: list[AnalyzedEvent] = []
    seg_indexes = find_adjustment_segments(samples)
    for n, (a, b) in enumerate(seg_indexes, start=1):
        events.append(AnalyzedEvent(
            id=f"{event_prefix}-adj-{n}",
            start_ms=samples[a].t_ms,
            end_ms=samples[b].t_ms,
            type="adjustment",
            metrics=segment_metrics(samples, a, b, tol),
        ))

    overshoots = find_overshoots(samples)
    for n, ov in enumerate(overshoots, start=1):
        start, end = ov["start_ms"], ov["end_ms"]
        if end <= start:                   # events 테이블의 CHECK(end_ms > start_ms)
            end = start + 1
        events.append(AnalyzedEvent(
            id=f"{event_prefix}-ovr-{n}",
            start_ms=start,
            end_ms=end,
            type="overshoot",
            metrics={k: v for k, v in ov.items() if k not in ("start_ms", "end_ms")},
        ))
    events.sort(key=lambda e: (e.start_ms, e.id))

    converged = (_position_error(last) <= tol["position_px"]
                 and abs(last.theta) <= tol["rotation_deg"])
    pattern = convergence_pattern(samples, tol)
    interference = [e.id for e in events
                    if e.type == "adjustment" and e.metrics.get("axisInterferenceFlag")]

    summary: dict[str, Any] = {
        # 실습과정_정렬.md 6절 지표 — 화면과 채점이 쓰는 값
        "final_dx": round(last.x, 3),
        "final_dy": round(last.y, 3),
        "final_dtheta": round(last.theta, 3),
        "duration_ms": duration_ms,
        "adjustment_count": sum(1 for e in events if e.type == "adjustment"),
        "overshoot_count": sum(1 for e in events if e.type == "overshoot"),
        "converged": converged,
        # 채점기가 보는 유일한 입력(실습유형_설계.md 4절).
        # 평평한 딕셔너리이고 값은 숫자·불리언·문자열만 쓴다.
        # 채점기는 이 이름들만 알면 되고, 이 지표가 무엇을 뜻하는지는 몰라도 된다.
        "scoring_metrics": scoring_metrics(last, tol, events, pattern, interference),
        # 규칙 기반 경로 분석 결과. AI 피드백의 근거로 그대로 넘긴다.
        "path_analysis": {
            "finalPositionError": round(_position_error(last), 3),
            "tolerance": tol,
            "toleranceNote": "허용 오차는 교육 과정 설정값이며 실제 장비의 정렬 정밀도가 아니다.",
            "convergence": pattern,
            "axisInterferenceEventIds": interference,
            "overshootByAxis": {ax: sum(1 for o in overshoots if o["movedAxis"] == ax)
                                for ax in AXES},
            "analyzerVersion": "rule-align-1.0.0",
        },
    }
    return AnalysisResult(summary=summary, events=events)


# --- 유형 인터페이스 (analyzers/__init__.py 의 규격) ----------------------

MEASURED = True          # 시계열 측정이 있는 유형이다


def build_answer(course: dict, body: dict) -> dict:
    """제출 본문을 검사해 answer 로 만든다. 형식이 틀리면 ValueError."""
    option = body.get("orderOptionId")
    if not option:
        raise ValueError("조정 순서를 선택해야 합니다.")
    valid = {o["id"] for o in course.get("content", {}).get("orderOptions", [])}
    if valid and option not in valid:
        raise ValueError(f"이 과정에 없는 조정 순서입니다: {option}")
    return {"orderOptionId": option, "reason": body.get("reason", "")}


def on_submit(course: dict, summary: dict | None, answer: dict,
              duration_ms: int | None = None) -> dict:
    """측정에서 만든 summary 에 답변에서 나오는 지표를 합친다."""
    summary = dict(summary or {})
    summary.setdefault("scoring_metrics", {}).update(answer_metrics(summary, answer))
    return summary
