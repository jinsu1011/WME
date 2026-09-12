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
