"""데모용 정렬 궤적 생성기.

합성 데이터다. 실측이 아니며, 화면은 이 시도를 source='mock' 으로 표시한다.
센서가 오면 같은 형태의 행이 measurements 에 들어오고 분석 코드는 그대로 쓴다.
"""
from __future__ import annotations

import math
import random

HZ = 50
DT_MS = 1000 // HZ


def _tilt_from_velocity(vx: float, vy: float) -> tuple[float, float]:
    """조이스틱 매핑의 역방향. 화면 이동 속도에 대응하는 컨트롤러 기울기(도)를 만든다.

    기울기가 곧 위치가 아니라 '이동 속도'라는 것을 데이터에서도 그대로 보이게 한다.
    """
    gain = 0.35                       # px/s 당 기울기(도)
    return max(-30.0, min(30.0, vy * gain)), max(-30.0, min(30.0, vx * gain))


def make_path(legs: list[dict], *, seed: int = 7, jitter: float = 0.12) -> list[dict]:
    """legs: [{'ms':1200,'to':(x,y,theta)}] 를 이어 붙여 50Hz 샘플을 만든다.

    각 구간은 부드럽게 가속·감속하고(코사인 보간), 손떨림 수준의 잡음을 더한다.
    """
    rng = random.Random(seed)
    x, y, th = legs[0]["to"]
    rows: list[dict] = []
    t = 0
    for leg in legs[1:]:
        tx, ty, tth = leg["to"]
        n = max(1, int(leg["ms"] / DT_MS))
        x0, y0, th0 = x, y, th
        for k in range(n):
            f = (1 - math.cos(math.pi * (k + 1) / n)) / 2      # 0→1 부드럽게
            nx = x0 + (tx - x0) * f
            ny = y0 + (ty - y0) * f
            nth = th0 + (tth - th0) * f
            vx = (nx - x) / (DT_MS / 1000)
            vy = (ny - y) / (DT_MS / 1000)
            roll, pitch = _tilt_from_velocity(vx, vy)
            x, y, th = nx, ny, nth
            t += DT_MS
            rows.append({
                "t_ms": t,
                "roll": round(roll + rng.gauss(0, jitter), 4),
                "pitch": round(pitch + rng.gauss(0, jitter), 4),
                "wafer_x": round(x + rng.gauss(0, jitter * 0.3), 4),
                "wafer_y": round(y + rng.gauss(0, jitter * 0.3), 4),
                "wafer_theta": round(th + rng.gauss(0, jitter * 0.05), 4),
                "quality": "ok",
            })
    return rows


# --- 데모 시나리오 --------------------------------------------------------

def clean_run() -> list[dict]:
    """절차를 지킨 시도: 위치를 먼저 맞추고 회전을 정리, 과잉 보정 거의 없음."""
    return make_path([
        {"ms": 0, "to": (38.0, -22.0, 2.6)},
        {"ms": 1400, "to": (38.0, -22.0, 2.6)},    # 마크 읽는 시간
        {"ms": 2200, "to": (6.0, -22.0, 2.6)},     # X 먼저
        {"ms": 600, "to": (6.0, -22.0, 2.6)},
        {"ms": 2000, "to": (6.0, -4.0, 2.6)},      # Y
        {"ms": 500, "to": (6.0, -4.0, 2.6)},
        {"ms": 1200, "to": (1.8, -1.2, 2.6)},      # 위치 미세 조정
        {"ms": 600, "to": (1.8, -1.2, 2.6)},
        {"ms": 1800, "to": (1.8, -1.2, 0.4)},      # 마지막에 회전
        {"ms": 900, "to": (1.9, -1.1, 0.35)},
    ], seed=11)


def overshoot_run() -> list[dict]:
    """첫 시도: 크게 움직여 목표를 지나치고, 회전을 먼저 건드려 위치가 틀어진 경우."""
    return make_path([
        {"ms": 0, "to": (34.0, 18.0, -3.2)},
        {"ms": 900, "to": (34.0, 18.0, -3.2)},
        {"ms": 1500, "to": (30.0, 14.0, -0.2)},    # 회전을 먼저 (순서 역전)
        {"ms": 1300, "to": (-14.0, 10.0, -0.2)},   # X 크게 → 지나침
        {"ms": 1100, "to": (7.0, 10.0, -0.2)},     # 되돌아옴 → 또 지나침
        {"ms": 900, "to": (-3.0, 10.0, -0.2)},
        {"ms": 900, "to": (1.5, 10.0, -0.2)},
        {"ms": 1400, "to": (1.5, -6.0, -0.2)},     # Y 지나침
        {"ms": 1000, "to": (1.5, 2.5, -0.2)},
        {"ms": 900, "to": (2.2, 0.6, -0.9)},       # 회전이 다시 틀어져 재조정
        {"ms": 800, "to": (2.4, 0.8, -0.6)},
    ], seed=23)


# --- 루브릭 값에 맞춰 궤적 모양을 만든다 ----------------------------------
# 시드 기록이 그래프와 따로 놀지 않게 하기 위한 것이다.
# 루브릭이 낮은 시도일수록 과잉 보정이 많고, 순서가 뒤바뀌고, 최종 오차가 크게 만든다.
# 저장되는 숫자(과잉 보정 횟수 등)는 이 궤적을 분석기가 실제로 읽어서 계산한 값이다.

START = (62.0, -44.0, 6.5)          # 과정 설정값 startOffset 과 같은 시작 위치

# 정렬 정확도(루브릭 1번) → 최종 오차
# 허용 오차는 위치 ±4px, 회전 ±1.0° 다(과정 설정값).
# 등급이 실제로 갈리는지 채점기로 확인하고 정한 값이다.
_FINAL = {
    2: (1.2, -0.8, 0.28),           # 여유 있게 안쪽 (위치 1.4px, 회전 0.28°)
    1: (3.2, -2.1, 0.86),           # 안이지만 경계에 가까움 (위치 3.8px, 회전 0.86°)
    0: (11.0, -8.0, 3.1),           # 확실히 밖 (위치 13.6px, 회전 3.1°)
}
# 보정 효율(루브릭 3번) → 목표를 몇 번 지나치게 할지
_OVERSHOOTS = {2: 0, 1: 2, 0: 4}


def _overshoot_legs(axis: str, base: tuple, count: int, ms: int) -> list[dict]:
    """한 축에서 목표를 지나쳤다 되돌아오는 구간을 count 번 만든다."""
    legs: list[dict] = []
    x, y, th = base
    swing = 15.0
    for i in range(count):
        swing *= 0.78 if i else 1.0
        sign = -1 if i % 2 == 0 else 1
        if axis == "x":
            legs.append({"ms": ms, "to": (sign * swing, y, th)})
        else:
            legs.append({"ms": ms, "to": (x, sign * swing, th)})
    return legs


def scenario(rubric: list[int] | None, *, seed: int) -> list[dict]:
    """루브릭 [정렬정확도, 조정순서, 보정효율, 설명기록] 에 맞는 궤적을 만든다.

    rubric 이 None 이면(제출하지 않은 시도) 허용 범위 밖에서 멈춘 궤적을 만든다.
    """
    if rubric is None:
        acc, order, eff = 0, 1, 1
    else:
        acc, order, eff = rubric[0], rubric[1], rubric[2]

    fx, fy, fth = _FINAL[acc]
    sx, sy, sth = START
    n_over = _OVERSHOOTS[eff]
    legs: list[dict] = [{"ms": 0, "to": START}, {"ms": 1200, "to": START}]  # 마크 읽는 시간

    def move_x():
        legs.append({"ms": 1600, "to": (fx, legs[-1]["to"][1], legs[-1]["to"][2])})
        legs.append({"ms": 900, "to": legs[-1]["to"]})

    def move_y():
        legs.append({"ms": 1500, "to": (legs[-1]["to"][0], fy, legs[-1]["to"][2])})
        legs.append({"ms": 900, "to": legs[-1]["to"]})

    def move_theta():
        legs.append({"ms": 1400, "to": (legs[-1]["to"][0], legs[-1]["to"][1], fth)})
        legs.append({"ms": 900, "to": legs[-1]["to"]})

    if order == 2:                  # 위치 먼저, 회전 마지막 (절차 준수)
        move_x()
        if n_over:
            legs += _overshoot_legs("y", legs[-1]["to"], n_over, 800)
        move_y()
        move_theta()
    elif order == 1:                # 번갈아 조정
        move_x()
        move_theta()
        if n_over:
            legs += _overshoot_legs("y", legs[-1]["to"], n_over, 800)
        move_y()
        move_theta()
    else:                           # 회전 먼저 → 위치가 틀어져 다시 손봄 (순서 역전)
        move_theta()
        if n_over:
            legs += _overshoot_legs("x", legs[-1]["to"], n_over, 800)
        move_x()
        move_y()
        move_theta()

    legs.append({"ms": 900, "to": (fx, fy, fth)})
    return make_path(legs, seed=seed)
