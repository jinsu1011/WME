#!/usr/bin/env python3
"""macOS에서 USB 시리얼을 115200 baud로 열고, 안정화 후 보드 시간 60초를 저장합니다."""
import argparse
import fcntl
import os
from pathlib import Path
import select
import sys
import termios
import time
import tty

from analyze_drift import DEFAULT_PATH, analyze_samples, parse_sample


def capture(port, output, settle_seconds):
    """포트를 독점해 기록합니다. 실패한 부분 기록은 보존하되 성공 판정은 하지 않습니다."""
    if output.exists():
        raise ValueError(f"기존 파일을 덮어쓰지 않습니다: {output}. --output으로 새 이름을 지정하세요.")
    output.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    original = None
    locked = False
    try:
        fcntl.ioctl(fd, termios.TIOCEXCL)  # 다른 프로그램이 새로 같은 포트를 열지 못하게 합니다.
        locked = True
        original = termios.tcgetattr(fd)
        tty.setraw(fd, termios.TCSANOW)
        settings = termios.tcgetattr(fd)
        settings[2] |= termios.CLOCAL | termios.CREAD
        settings[4] = termios.B115200
        settings[5] = termios.B115200
        termios.tcsetattr(fd, termios.TCSANOW, settings)
        termios.tcflush(fd, termios.TCIFLUSH)
        print(f"포트: {port}, 115200 baud. 보드를 평평하게 두고 손대지 마세요.", flush=True)
        print(f"첫 정상 샘플부터 {settle_seconds}초 안정화 후 60초를 기록합니다.", flush=True)
        buffer = bytearray()
        samples = []
        first_seen = None
        previous_t = None
        deadline = time.monotonic() + settle_seconds + 80
        # x 모드는 기존 실측 자료를 실수로 덮어쓰지 않습니다.
        with output.open("x", encoding="utf-8", newline="") as destination:
            while time.monotonic() < deadline:
                readable, _, _ = select.select([fd], [], [], 1.0)
                if not readable:
                    continue
                try:
                    chunk = os.read(fd, 4096)
                except BlockingIOError:
                    continue
                if not chunk:
                    raise ValueError("USB 연결이 종료되었습니다.")
                buffer.extend(chunk)
                if len(buffer) > 16384:
                    raise ValueError("줄바꿈 없는 데이터가 너무 깁니다. 통신 속도와 스케치를 확인하세요.")
                while b"\n" in buffer:
                    raw, _, remainder = buffer.partition(b"\n")
                    buffer = bytearray(remainder)
                    # 포트를 연 순간의 잘린 한 줄/부팅 문자는 첫 정상 샘플 전까지만 무시합니다.
                    try:
                        line = raw.decode("ascii").rstrip("\r")
                        sample = parse_sample(line)
                    except (UnicodeError, ValueError):
                        if first_seen is None and not raw.startswith(b"ERR,"):
                            continue
                        raise
                    if sample is None:
                        continue
                    if previous_t is not None and sample[0] <= previous_t:
                        raise ValueError("기록 중 보드 시각이 역행했습니다. 리셋 또는 중복 데이터입니다.")
                    previous_t = sample[0]
                    if first_seen is None:
                        first_seen = sample[0]
                    if sample[0] - first_seen < settle_seconds * 1000:
                        continue
                    if not samples:
                        print("60초 기록 시작. 완료 문구가 나올 때까지 손대지 마세요.", flush=True)
                    destination.write(line + "\n")
                    samples.append(sample)
                    if len(samples) % 250 == 0:
                        destination.flush()
                        print(f"기록 중: {(sample[0] - samples[0][0]) / 1000:.1f} / 60초", flush=True)
                    if sample[0] - samples[0][0] >= 60000:
                        result = analyze_samples(samples)
                        print(f"저장 완료: {output} ({result['duration_s']:.3f}초, {len(samples)}개)", flush=True)
                        return
            raise ValueError("제한 시간 안에 정상적인 60초 기록을 얻지 못했습니다. 스케치·배선·포트 점유를 확인하세요.")
    finally:
        try:
            if original is not None:
                termios.tcsetattr(fd, termios.TCSANOW, original)
        finally:
            try:
                if locked:
                    fcntl.ioctl(fd, termios.TIOCNXCL)
            finally:
                os.close(fd)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default="/dev/cu.usbmodem1101")
    parser.add_argument("--output", type=Path, default=DEFAULT_PATH)
    parser.add_argument("--settle-seconds", type=int, default=30, help="정지 안정화 시간, 기본 30초")
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("이 기록 도구는 macOS용입니다. 분석 도구는 다른 OS에서도 사용할 수 있습니다.")
    if not 0 <= args.settle_seconds <= 300:
        parser.error("안정화 시간은 0~300초여야 합니다.")
    try:
        capture(args.port, args.output, args.settle_seconds)
    except (OSError, ValueError, UnicodeError, KeyboardInterrupt) as error:
        print(f"기록 중단: {error or '사용자 중단'}", file=sys.stderr)
        print("생성된 파일은 부분 기록일 수 있습니다. 완전한 측정으로 보고하지 마세요.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
