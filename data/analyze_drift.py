#!/usr/bin/env python3
"""WME 실측 파일의 1분 드리프트를 분석합니다. Python 기본 기능만 사용합니다."""
import argparse
import json
import math
from pathlib import Path
import re
import sys

LINE = re.compile(r"WME,([0-9]+),(-?[0-9]+\.[0-9]{2}),(-?[0-9]+\.[0-9]{2}),(-?[0-9]+\.[0-9]{2})")
DEFAULT_PATH = Path(__file__).resolve().parent / "raw" / "drift_2026-09-13.csv"


def parse_sample(line):
    """정상 형식만 받습니다. 부팅 안내는 무시하고 오류/손상 샘플은 거부합니다."""
    line = line.rstrip("\r\n")
    if line.startswith("ERR,"):
        raise ValueError(f"센서 오류가 포함되어 있습니다: {line}")
    if not line or line.startswith("INFO,") or line.startswith("#"):
        return None
    match = LINE.fullmatch(line)
    if match is None:
        raise ValueError(f"WME 형식이 아닌 줄입니다: {line[:100]!r}")
    timestamp = int(match[1])
    values = tuple(float(match[i]) for i in (2, 3, 4))
    if timestamp > 0xFFFFFFFF or not all(math.isfinite(v) for v in values):
        raise ValueError("시각 범위 초과 또는 유효하지 않은 각도입니다.")
    return (timestamp, *values)


def analyze_samples(samples):
    """보드 시간으로 60초 기록인지 검증한 후, 요청한 세 숫자를 계산합니다."""
    if len(samples) < 2:
        raise ValueError("샘플이 부족합니다. 1분간 다시 기록하세요.")
    gaps = [b[0] - a[0] for a, b in zip(samples, samples[1:])]
    if min(gaps) <= 0:
        raise ValueError("시각이 중복되거나 역행합니다. 보드 리셋/여러 세션 혼합 여부를 확인하세요.")
    duration_ms = samples[-1][0] - samples[0][0]
    if not 60000 <= duration_ms <= 60100:
        raise ValueError(f"기록 길이가 {duration_ms / 1000:.3f}초입니다. 수집 도구로 60초를 기록하세요.")
    hz = (len(samples) - 1) * 1000 / duration_ms
    if max(gaps) > 100 or not 45 <= hz <= 55:
        raise ValueError(f"기록 끊김/주기 이상: 최대 간격 {max(gaps)}ms, 평균 {hz:.2f}Hz. 재측정하세요.")
    roll_range = max(s[1] for s in samples) - min(s[1] for s in samples)
    pitch_range = max(s[2] for s in samples) - min(s[2] for s in samples)
    # 두 자리 출력값으로 계산하므로 반올림하여 ±1.00 경계의 부동소수점 오차를 피합니다.
    yaw_drift = round(samples[-1][3] - samples[0][3], 2)
    return {
        "samples": len(samples), "duration_s": duration_ms / 1000,
        "average_hz": round(hz, 3), "max_gap_ms": max(gaps),
        "roll_range_deg": round(roll_range, 2),
        "pitch_range_deg": round(pitch_range, 2), "yaw_drift_deg": yaw_drift,
        "yaw_abs_drift_deg": abs(yaw_drift), "threshold_deg": 1.0,
        "decision": "screen_buttons" if abs(yaw_drift) > 1.0 else "within_drift_limit",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_PATH)
    parser.add_argument("--json", action="store_true", help="결과를 JSON 형식으로 출력")
    args = parser.parse_args()
    try:
        samples = []
        with args.path.open(encoding="utf-8") as source:
            for number, line in enumerate(source, 1):
                try:
                    sample = parse_sample(line)
                except ValueError as error:
                    raise ValueError(f"{number}번째 줄: {error}") from error
                if sample is not None:
                    samples.append(sample)
        result = analyze_samples(samples)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"분석 중단: {error}\n회전 사용 여부는 판정하지 않았습니다.", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"파일: {args.path}")
        print(f"기록: {result['duration_s']:.3f}초 / {result['samples']}개 / 평균 {result['average_hz']:.2f}Hz")
        print(f"roll 흔들린 폭: {result['roll_range_deg']:.2f}° (최대 - 최소)")
        print(f"pitch 흔들린 폭: {result['pitch_range_deg']:.2f}° (최대 - 최소)")
        print(f"yaw 밀림: {result['yaw_drift_deg']:+.2f}° (끝 - 시작), 절댓값 {result['yaw_abs_drift_deg']:.2f}°")
        if result['decision'] == 'screen_buttons':
            print("판정: 1.00° 초과 → 회전은 센서 대신 화면 버튼 사용. HEADER에 결과를 전달하세요.")
        else:
            print("판정: 1.00° 이내 → 이번 정지 드리프트 기준 충족. 결과를 HEADER에 전달하세요.")
        print("이 판정은 파일의 숫자에 대한 것입니다. 실제 정지 상태와 배선 접촉은 별도 확인이 필요합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
