import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * 정렬 실습의 3D 장비 뷰.
 *
 * React 밖에서 돈다. 매 프레임 `readPose()` 를 직접 호출해 최신 자세를 읽으므로
 * 리액트 상태를 거치지 않는다 — 손(또는 키보드)을 움직인 즉시 화면이 따라온다.
 *
 * 화면에 보이는 것만 담당한다. 저장되는 값·판정·채점은 이 파일과 무관하다.
 * 포토리얼이 목표가 아니다. 발광·스캔라인·파티클·후처리를 쓰지 않는다(빔프로젝터 가독성).
 */
export interface StagePose {
  /** 화면 단위(px) 기준 남은 위치 오차 */
  x: number
  y: number
  /** 회전 오차(도) */
  theta: number
  /** 모형 기울기(도). 키보드 모드에서는 0 이다. */
  roll: number
  pitch: number
  /** 링을 초록으로 칠할지 — 정렬 유지 성공 뒤에만 참이다 */
  level: boolean
  /** 정렬 유지 진행률 0~1. 유지하는 동안 링이 조금씩 초록으로 물든다 */
  levelProgress?: number
  /** 정렬 유지 시간을 채워 실습 성공인지. 성공하는 순간 링이 깜빡이고 마스크가 내려온다 */
  levelConfirmed?: boolean
}

export interface SceneOptions {
  /** 화면 px 을 3D 길이로 바꾸는 기준. 이 값이 웨이퍼 반지름에 대응한다. */
  fieldRadius: number
}

/** 시점 초기화 요청을 3D 컨테이너로 보낼 때 쓰는 이벤트 이름 */
export const RESET_VIEW_EVENT = 'wme:reset-view'

/** 노광·현상 연출을 재생하라는 요청 */
export const PLAY_EXPOSURE_EVENT = 'wme:play-exposure'

/** 연출을 지우고 조정 상태로 돌아가라는 요청 */
export const CLEAR_EXPOSURE_EVENT = 'wme:clear-exposure'

/**
 * 정렬을 확정한 뒤 보여 주는 단계.
 * 실제 순서(노광 → 현상 → 패턴 확인)를 그대로 따른다.
 */
export type ExposureStage = 'expose' | 'develop' | 'result' | null

const WAFER_RADIUS = 1
const DEG = Math.PI / 180

/** 웨이퍼 표면 캔버스 크기. 반지름 절반이 웨이퍼 반지름에 대응한다. */
const SURFACE_SIZE = 512

/**
 * 웨이퍼 표면을 그린다 — 다이(칩) 격자와 정렬 마크(십자).
 * `pattern` 이 있으면 노광·현상으로 새겨진 패턴을 그 위에 그린다.
 * 패턴은 **노광 순간의 마스크 자리**에 찍히므로, 정렬 오차만큼 웨이퍼 마크에서 벗어난다.
 */
function drawWaferSurface(
  ctx: CanvasRenderingContext2D,
  pattern?: { alpha: number; dx: number; dy: number; dTheta: number; scale: number },
  develop?: { radius: number },
): void {
  const size = SURFACE_SIZE

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#c8ccd4'
  ctx.fillRect(0, 0, size, size)

  // 다이 격자
  ctx.strokeStyle = 'rgba(70,80,95,0.45)'
  ctx.lineWidth = 2
  const step = size / 12
  for (let i = 1; i < 12; i++) {
    ctx.beginPath()
    ctx.moveTo(i * step, 0)
    ctx.lineTo(i * step, size)
    ctx.moveTo(0, i * step)
    ctx.lineTo(size, i * step)
    ctx.stroke()
  }

  // 가운데 정렬 마크(십자) — 마스크의 사각 프레임 안에 들어가야 한다
  const c = size / 2
  ctx.strokeStyle = '#1f4fa8'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(c - 52, c)
  ctx.lineTo(c + 52, c)
  ctx.moveTo(c, c - 52)
  ctx.lineTo(c, c + 52)
  ctx.stroke()

  // 현상액이 중앙에서 가장자리로 퍼진다(0~1 = 웨이퍼 반지름).
  if (develop && develop.radius > 0) {
    const r = develop.radius * (size / 2)
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.fillStyle = '#7fb2e8'
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.fill()
    // 퍼지는 앞머리를 진하게 해서 움직임이 보이게 한다
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = '#5b95d6'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  if (!pattern || pattern.alpha <= 0) return

  // 노광·현상으로 새겨진 패턴. 마스크가 있던 자리에 찍히므로 오차만큼 어긋난다.
  ctx.save()
  ctx.globalAlpha = Math.min(1, pattern.alpha)
  ctx.translate(c - pattern.dx * pattern.scale, c - pattern.dy * pattern.scale)
  ctx.rotate((-pattern.dTheta * Math.PI) / 180)

  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = 14
  ctx.strokeRect(-96, -96, 192, 192)

  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 8
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 26, -74)
    ctx.lineTo(i * 26, 74)
    ctx.stroke()
  }

  // 모서리 표식 — 회전이 틀어진 것이 한눈에 보인다
  ctx.fillStyle = '#1f2937'
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    ctx.fillRect(sx * 124 - 11, sy * 124 - 11, 22, 22)
  }
  ctx.restore()
}

/** 마스크 판 — 고정된 정렬 마크(사각 프레임)를 그린다. 나머지는 투명하다. */
function maskTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)

  // 판 자체는 아주 옅게
  ctx.fillStyle = 'rgba(226,232,240,0.30)'
  ctx.fillRect(0, 0, size, size)

  const c = size / 2
  ctx.strokeStyle = '#5b6676'
  ctx.lineWidth = 8
  ctx.strokeRect(c - 74, c - 74, 148, 148)

  // 바깥 눈금
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(c - 104, c)
  ctx.lineTo(c - 84, c)
  ctx.moveTo(c + 84, c)
  ctx.lineTo(c + 104, c)
  ctx.moveTo(c, c - 104)
  ctx.lineTo(c, c - 84)
  ctx.moveTo(c, c + 84)
  ctx.lineTo(c, c + 104)
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  return texture
}

export class AlignmentScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private tiltGroup = new THREE.Group()
  private wafer = new THREE.Group()
  private maskPlate: THREE.Mesh
  private maskRing: THREE.Mesh
  /** 웨이퍼 표면(다이 격자·마크·새겨진 패턴)을 그리는 캔버스 */
  private surfaceCtx: CanvasRenderingContext2D
  private surfaceTexture: THREE.CanvasTexture
  /** 노광 순간의 정렬 오차. 패턴이 찍히는 자리를 정한다 */
  private exposedAt = { dx: 0, dy: 0, dTheta: 0 }
  private drawnAlpha = -1
  private drawnDevelop = -1
  /** 위에서 떨어지는 현상액(노즐 + 액 방울) */
  private dropper: THREE.Group
  private dropletMesh: THREE.Mesh
  /** 지금 재생 중인 단계와 경과 시간 */
  private exposure: { stage: ExposureStage; t: number } = { stage: null, t: 0 }
  private lastFrameAt = 0
  /** 단계가 바뀌면 화면에 알린다 */
  onExposureStage: ((stage: ExposureStage) => void) | null = null
  private controls: OrbitControls
  private container: HTMLElement
  private options: SceneOptions
  private readPose: () => StagePose
  private frame: number | null = null
  private disposables: { dispose: () => void }[] = []
  /** 아주 약한 보간. 손의 떨림만 다듬고 지연은 만들지 않는다. */
  private shown: StagePose = { x: 0, y: 0, theta: 0, roll: 0, pitch: 0, level: false }
  private started = false
  /** 그래픽 컨텍스트를 잃었을 때 알린다. 화면은 2D 뷰로 내려간다. */
  onContextLost: (() => void) | null = null
  private handlePointerUp = () => {
    this.renderer.domElement.style.cursor = 'grab'
  }
  private handleContextLost = (event: Event) => {
    // 기본 동작을 막아야 복구(restored) 이벤트를 받을 수 있다.
    event.preventDefault()
    this.stop()
    this.onContextLost?.()
  }

  constructor(container: HTMLElement, options: SceneOptions, readPose: () => StagePose) {
    this.container = container
    this.options = options
    this.readPose = readPose

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    // 발표용 노트북에서 프레임이 떨어지지 않도록 픽셀 비율을 제한한다.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = false
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50)
    // 시작 시점. 스테이지 전체와 마스크 판이 한 화면에 들어오도록 뒤로 물려 둔다.
    this.camera.position.set(0, 3.1, 5.0)
    this.camera.lookAt(0, 0.05, 0)

    /**
     * 마우스로 잡고 끌어 시점을 바꾼다.
     * - 회전만 허용한다. 줌(휠)을 켜면 카드 위에서 페이지 스크롤이 막힌다
     * - 이동(팬)도 끈다. 물체를 화면 밖으로 끌고 나가 길을 잃는 것을 막는다
     * - 바닥 아래로 내려가지 못하게 각도를 제한한다
     */
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.05, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enableZoom = false
    this.controls.enablePan = false
    this.controls.rotateSpeed = 0.7
    // 너무 눕히면 웨이퍼가 선처럼 보여 실습을 못 한다. 쓸 수 있는 각도로만 제한한다.
    this.controls.minPolarAngle = 0.2
    this.controls.maxPolarAngle = 1.2
    this.controls.update()
    // 시점 초기화 버튼이 돌아올 지점
    this.controls.saveState()
    this.renderer.domElement.style.cursor = 'grab'
    // 시점 초기화는 컨테이너 이벤트로 받는다.
    // 리액트가 장면 객체를 들고 있지 않아도 되고, 장면이 다시 만들어져도 어긋나지 않는다.
    this.container.addEventListener(RESET_VIEW_EVENT, this.resetView)
    this.container.addEventListener(PLAY_EXPOSURE_EVENT, this.playExposure)
    this.container.addEventListener(CLEAR_EXPOSURE_EVENT, this.clearExposure)
    this.renderer.domElement.addEventListener('pointerdown', () => {
      this.renderer.domElement.style.cursor = 'grabbing'
    })
    window.addEventListener('pointerup', this.handlePointerUp)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const key = new THREE.DirectionalLight(0xffffff, 1.15)
    key.position.set(2.5, 4, 2.5)
    this.scene.add(key)

    // ── 스테이지(웨이퍼를 받치는 금속 원통)
    const stageGeo = new THREE.CylinderGeometry(1.18, 1.24, 0.26, 64)
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x9aa3ad,
      metalness: 0.55,
      roughness: 0.45,
    })
    const stage = new THREE.Mesh(stageGeo, stageMat)
    stage.position.y = -0.16
    this.tiltGroup.add(stage)
    this.disposables.push(stageGeo, stageMat)

    // ── 웨이퍼(기판): 얇은 원판 + 다이 격자 + 노치
    const waferGeo = new THREE.CylinderGeometry(WAFER_RADIUS, WAFER_RADIUS, 0.035, 96)
    const surfaceCanvas = document.createElement('canvas')
    surfaceCanvas.width = SURFACE_SIZE
    surfaceCanvas.height = SURFACE_SIZE
    this.surfaceCtx = surfaceCanvas.getContext('2d')!
    drawWaferSurface(this.surfaceCtx)
    const topTexture = new THREE.CanvasTexture(surfaceCanvas)
    topTexture.anisotropy = 4
    this.surfaceTexture = topTexture
    const waferTop = new THREE.MeshStandardMaterial({
      map: topTexture,
      metalness: 0.35,
      roughness: 0.32,
    })
    const waferSide = new THREE.MeshStandardMaterial({
      color: 0xb6bcc6,
      metalness: 0.45,
      roughness: 0.3,
    })
    // [옆면, 윗면, 아랫면] 순서로 재질을 준다
    const waferMesh = new THREE.Mesh(waferGeo, [waferSide, waferTop, waferSide])
    this.wafer.add(waferMesh)
    this.disposables.push(waferGeo, waferTop, waferSide, topTexture)

    // 노치 — 방향을 알 수 있게 가장자리에 홈 하나
    const notchGeo = new THREE.BoxGeometry(0.12, 0.05, 0.1)
    const notchMat = new THREE.MeshStandardMaterial({ color: 0x6b7482, roughness: 0.6 })
    const notch = new THREE.Mesh(notchGeo, notchMat)
    notch.position.set(0, 0.004, WAFER_RADIUS - 0.02)
    this.wafer.add(notch)
    this.disposables.push(notchGeo, notchMat)

    this.wafer.position.y = 0.02
    this.tiltGroup.add(this.wafer)

    // ── 마스크: 웨이퍼 위에 떠 있는 반투명 판
    const maskGeo = new THREE.PlaneGeometry(2.1, 2.1)
    const maskTex = maskTexture()
    const maskMat = new THREE.MeshBasicMaterial({
      map: maskTex,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    this.maskPlate = new THREE.Mesh(maskGeo, maskMat)
    this.maskPlate.rotation.x = -Math.PI / 2
    this.maskPlate.position.y = 0.42
    this.scene.add(this.maskPlate)
    this.disposables.push(maskGeo, maskMat, maskTex)

    // 마스크 테두리 — 평행이 확보되면 색이 바뀐다(문구·배지와 함께 쓴다)
    const ringGeo = new THREE.TorusGeometry(1.08, 0.016, 8, 96)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8493a8 })
    this.maskRing = new THREE.Mesh(ringGeo, ringMat)
    this.maskRing.rotation.x = -Math.PI / 2
    this.maskRing.position.y = 0.42
    this.scene.add(this.maskRing)
    this.disposables.push(ringGeo, ringMat)

    // ── 현상액을 떨어뜨리는 노즐과 액 방울.
    // 불투명 물체로 만든다 — 투명 평면은 다른 물체에 가려 잘 보이지 않는다.
    this.dropper = new THREE.Group()
    const nozzleGeo = new THREE.CylinderGeometry(0.06, 0.045, 0.45, 20)
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x8f98a3,
      metalness: 0.5,
      roughness: 0.4,
    })
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat)
    nozzle.position.y = 1.75
    this.dropper.add(nozzle)
    this.disposables.push(nozzleGeo, nozzleMat)

    const dropGeo = new THREE.SphereGeometry(0.085, 20, 16)
    const dropMat = new THREE.MeshStandardMaterial({
      color: 0x5b95d6,
      roughness: 0.15,
      metalness: 0.05,
    })
    this.dropletMesh = new THREE.Mesh(dropGeo, dropMat)
    this.dropletMesh.position.y = 1.5
    this.dropper.add(this.dropletMesh)
    this.disposables.push(dropGeo, dropMat)

    this.dropper.visible = false
    this.scene.add(this.dropper)

    this.scene.add(this.tiltGroup)
    this.resize()
  }

  /** 개발 확인용 — 지금 3D 가 실제로 어디에 그려져 있는지 숫자로 읽는다. */
  debugState = () => ({
    waferX: this.wafer.position.x,
    waferZ: this.wafer.position.z,
    waferRotY: this.wafer.rotation.y,
    tiltZ: this.tiltGroup.rotation.z,
    tiltX: this.tiltGroup.rotation.x,
    frames: this.renderer.info.render.frame,
    exposure: this.exposure.stage,
    patternAlpha: this.drawnAlpha,
    exposedAt: this.exposedAt,
  })

  resize = (): void => {
    const width = this.container.clientWidth || 1
    const height = this.container.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  start = (): void => {
    if (this.started) return
    this.started = true
    const loop = () => {
      if (!this.started) return
      // 백그라운드 탭에서는 브라우저가 requestAnimationFrame 을 주지 않는다.
      // 그래서 따로 document.hidden 을 보지 않는다 — 그 조건을 넣으면 창이 '보이지 않는 것으로
      // 보고되는' 환경(임베드된 미리보기 등)에서 화면이 통째로 비어 버린다.
      this.renderFrame()
      this.frame = requestAnimationFrame(loop)
    }
    this.frame = requestAnimationFrame(loop)
  }

  stop = (): void => {
    this.started = false
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
  }

  /**
   * 노광 → 현상 → 패턴 확인을 재생한다.
   * 정렬을 확정한 그 자세 그대로 패턴이 웨이퍼에 남으므로,
   * 오차가 컸다면 패턴이 마스크 프레임과 어긋나 보인다.
   */
  playExposure = (event?: Event): void => {
    // 노광 순간의 오차를 기억한다. 패턴은 그 자리에 찍힌다.
    const detail = (event as CustomEvent<{ dx: number; dy: number; dTheta: number }>)?.detail
    const pose = this.readPose()
    this.exposedAt = detail ?? { dx: pose.x, dy: pose.y, dTheta: pose.theta }
    this.exposure = { stage: 'expose', t: 0 }
    this.drawnAlpha = -1
    this.drawnDevelop = -1
    this.dropper.visible = false
    this.onExposureStage?.('expose')
  }

  /** 연출을 지우고 처음 상태로 되돌린다. */
  clearExposure = (): void => {
    this.exposure = { stage: null, t: 0 }
    this.dropper.visible = false
    ;(this.maskPlate.material as THREE.MeshBasicMaterial).opacity = 0.95
    this.paintSurface(0, 0)
    this.onExposureStage?.(null)
  }

  /** 웨이퍼 표면을 다시 그린다. 패턴 진하기가 바뀔 때만 다시 그린다. */
  private paintSurface(alpha: number, developRadius = 0): void {
    if (
      Math.abs(alpha - this.drawnAlpha) < 0.02 &&
      Math.abs(developRadius - this.drawnDevelop) < 0.02
    ) {
      return
    }
    this.drawnAlpha = alpha
    this.drawnDevelop = developRadius
    const scale = SURFACE_SIZE / 2 / this.options.fieldRadius
    drawWaferSurface(
      this.surfaceCtx,
      {
        alpha,
        dx: this.exposedAt.dx,
        dy: this.exposedAt.dy,
        dTheta: this.exposedAt.dTheta,
        scale,
      },
      { radius: developRadius },
    )
    this.surfaceTexture.needsUpdate = true
  }

  /**
   * 노광·현상 연출을 한 프레임 진행한다.
   * 노광(1.0s) → 액 떨어짐(0.8s) → 퍼지며 패턴이 드러남(1.4s) → 결과
   */
  private stepExposure(dt: number): void {
    if (this.exposure.stage === null) return
    this.exposure.t += dt
    const t = this.exposure.t
    const maskMat = this.maskPlate.material as THREE.MeshBasicMaterial

    const EXPOSE_END = 1.0
    const DROP_END = 1.8
    const DEVELOP_END = 3.2

    if (t < EXPOSE_END) {
      // 1) 노광 — 마스크 너머로 빛을 쬔다. 번쩍이지 않게 판이 잠깐 또렷해지는 정도로만.
      if (this.exposure.stage !== 'expose') {
        this.exposure.stage = 'expose'
        this.onExposureStage?.('expose')
      }
      const p = t / EXPOSE_END
      maskMat.opacity = 0.95 + Math.sin(p * Math.PI) * 0.05
      this.dropper.visible = false
      this.paintSurface(0, 0)
    } else if (t < DROP_END) {
      // 2) 현상액이 위에서 내려온다. 노즐에서 방울이 웨이퍼까지 떨어진다.
      if (this.exposure.stage !== 'develop') {
        this.exposure.stage = 'develop'
        this.onExposureStage?.('develop')
      }
      const p = (t - EXPOSE_END) / (DROP_END - EXPOSE_END)
      maskMat.opacity = 0.95
      this.dropper.visible = true
      // 1.5 에서 웨이퍼 바로 위(0.12)까지 떨어진다. 뒤로 갈수록 빨라진다.
      this.dropletMesh.position.y = 1.5 - (1.5 - 0.12) * p * p
      this.dropletMesh.scale.set(1 - p * 0.2, 1 + p * 0.35, 1 - p * 0.2)
      this.paintSurface(0, 0)
    } else if (t < DEVELOP_END) {
      // 3) 닿은 자리에서 가장자리로 퍼진다. 지나간 자리부터 패턴이 드러난다.
      const p = (t - DROP_END) / (DEVELOP_END - DROP_END)
      const eased = 1 - (1 - p) ** 3
      maskMat.opacity = 0.95
      this.dropper.visible = p < 0.35
      this.dropletMesh.position.y = 0.12
      this.paintSurface(eased, eased * 0.98)
    } else {
      // 4) 결과 — 액이 마르고 패턴만 남는다
      if (this.exposure.stage !== 'result') {
        this.exposure.stage = 'result'
        this.onExposureStage?.('result')
      }
      this.dropper.visible = false
      this.paintSurface(1, 0)
    }
  }

  /** 평행 확보가 완료된 순간부터 링을 깜빡이는 시각(ms). 지나면 초록으로 멈춘다 */
  private levelBlinkUntil = 0
  private wasLevelConfirmed = false
  private ringGray = new THREE.Color(0x8493a8)
  private ringGreen = new THREE.Color(0x0ca30c)
  private ringColor = new THREE.Color(0x8493a8)

  /** 한 프레임 그린다. 자세는 매번 새로 읽는다(리액트 상태를 기다리지 않는다). */
  private renderFrame(): void {
    const now = performance.now()
    // 연출은 물리 계산이 아니라 시간표다. 프레임이 드물어도 실제 시간만큼 진행시킨다.
    // (조작 적분과 달리 여기서는 크게 잘라내지 않는다)
    const dt = this.lastFrameAt === 0 ? 0 : Math.min(0.5, (now - this.lastFrameAt) / 1000)
    this.lastFrameAt = now
    this.stepExposure(dt)

    const pose = this.readPose()
    const s = this.shown
    // 보간 계수가 클수록 즉각적이다. 떨림만 다듬을 정도로만 둔다.
    const k = 0.55
    s.x += (pose.x - s.x) * k
    s.y += (pose.y - s.y) * k
    s.theta += (pose.theta - s.theta) * k
    s.roll += (pose.roll - s.roll) * k
    s.pitch += (pose.pitch - s.pitch) * k
    s.level = pose.level

    const scale = WAFER_RADIUS / this.options.fieldRadius
    this.wafer.position.x = s.x * scale
    this.wafer.position.z = s.y * scale
    this.wafer.rotation.y = -s.theta * DEG

    // 모형 기울기는 스테이지째 기운다. 마스크는 고정되어 있으므로 평행이 깨지는 게 보인다.
    this.tiltGroup.rotation.z = -s.roll * DEG
    this.tiltGroup.rotation.x = s.pitch * DEG

    // 마우스로 돌린 시점을 부드럽게 따라가게 한다(감쇠를 쓰면 매 프레임 호출해야 한다).
    this.controls.update()

    // 평행 확보가 완료되는 순간 링을 깜빡이고, 마스크를 웨이퍼 가까이(근접 간격) 내린다.
    // 실제 얼라이너도 평행을 맞춘 뒤 간격을 좁히고 위치·회전을 맞춘다. 발광 효과는 쓰지 않는다.
    const confirmed = pose.levelConfirmed ?? false
    if (confirmed && !this.wasLevelConfirmed) this.levelBlinkUntil = now + 1500
    this.wasLevelConfirmed = confirmed

    const maskTargetY = confirmed ? 0.3 : 0.42
    const maskY = this.maskPlate.position.y + (maskTargetY - this.maskPlate.position.y) * 0.08
    this.maskPlate.position.y = maskY
    this.maskRing.position.y = maskY

    if (now < this.levelBlinkUntil) {
      const on = Math.floor((this.levelBlinkUntil - now) / 250) % 2 === 0
      this.ringColor.copy(on ? this.ringGreen : this.ringGray)
    } else if (s.level) {
      this.ringColor.copy(this.ringGreen)
    } else {
      // 유지하는 동안 조금씩 초록으로 물든다(키보드 모드에는 진행률이 없어 회색 그대로)
      this.ringColor.copy(this.ringGray).lerp(this.ringGreen, (pose.levelProgress ?? 0) * 0.6)
    }
    ;(this.maskRing.material as THREE.MeshBasicMaterial).color.copy(this.ringColor)

    this.renderer.render(this.scene, this.camera)
  }

  /**
   * 시점을 처음 각도로 되돌린다.
   * 감쇠(damping)가 켜져 있으면 reset 직후 남은 관성이 이전 각도를 되살린다.
   * 그래서 잠깐 끄고 되돌린 뒤 다시 켠다.
   */
  resetView = (): void => {
    const damping = this.controls.enableDamping
    // 끌고 있던 제스처가 남아 있으면 되돌린 시점이 곧바로 다시 밀린다.
    // 컨트롤을 잠깐 꺼서 진행 중인 동작을 끊고, 감쇠도 끈 채로 되돌린다.
    this.controls.enabled = false
    this.controls.enableDamping = false
    this.controls.reset()
    this.controls.update()
    this.controls.enableDamping = damping
    this.controls.enabled = true
  }

  dispose = (): void => {
    this.stop()
    this.controls.dispose()
    this.container.removeEventListener(RESET_VIEW_EVENT, this.resetView)
    this.container.removeEventListener(PLAY_EXPOSURE_EVENT, this.playExposure)
    this.container.removeEventListener(CLEAR_EXPOSURE_EVENT, this.clearExposure)
    window.removeEventListener('pointerup', this.handlePointerUp)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost)
    for (const item of this.disposables) item.dispose()
    this.renderer.dispose()
    // 컨텍스트 자리를 바로 돌려준다(화면을 옮겨 다녀도 자리가 모자라지 않게).
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}

/**
 * WebGL 을 쓸 수 있는 환경인지. 못 쓰면 화면은 2D 뷰로 대체한다.
 * 확인용으로 만든 컨텍스트는 바로 반납한다 — 브라우저가 동시에 쥘 수 있는 컨텍스트 수가
 * 제한돼 있어, 버려두면 정작 장면을 만들 때 자리가 없다.
 */
export function supportsWebGL(): boolean {
  try {
    if (!window.WebGLRenderingContext) return false
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as
      | WebGLRenderingContext
      | null
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
