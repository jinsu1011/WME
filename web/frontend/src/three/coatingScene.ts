import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * 감광액 도포(스핀 코팅) 데모 장면.
 *
 * 정렬 실습 앞에 오는 공정을 눈으로 보여 주기 위한 **설명용 그림**이다.
 * 조작·기록·채점과 무관하고, 저장되는 값도 없다.
 *
 * 순서: 중앙에 액을 떨어뜨린다 → 웨이퍼를 돌린다 → 원심력으로 퍼져 얇은 막이 남는다.
 * 포토리얼이 목표가 아니다. 발광·파티클·후처리를 쓰지 않는다.
 */
export type CoatingStage = 'dispense' | 'spin' | 'film'

const WAFER_RADIUS = 1
/** 한 바퀴 전체 길이(초). 단계별 길이는 아래 STAGE_ENDS 로 나눈다. */
const CYCLE_SEC = 7.5
const STAGE_ENDS = { dispense: 2.2, spin: 5.4, film: CYCLE_SEC }

export class CoatingScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private container: HTMLElement
  private wafer = new THREE.Group()
  private droplet: THREE.Mesh
  private film: THREE.Mesh
  private nozzle: THREE.Group
  private frame: number | null = null
  private started = false
  private t = 0
  private last = 0
  private disposables: { dispose: () => void }[] = []

  /** 지금 어느 단계인지 화면에 알린다. */
  onStage: ((stage: CoatingStage) => void) | null = null
  private stage: CoatingStage = 'dispense'
  onContextLost: (() => void) | null = null

  private handleContextLost = (event: Event) => {
    event.preventDefault()
    this.stop()
    this.onContextLost?.()
  }

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = false
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost)

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50)
    this.camera.position.set(0, 2.6, 4.2)
    this.camera.lookAt(0, 0.1, 0)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.1, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enableZoom = false
    this.controls.enablePan = false
    this.controls.minPolarAngle = 0.25
    this.controls.maxPolarAngle = 1.25
    this.controls.update()
    this.renderer.domElement.style.cursor = 'grab'

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const key = new THREE.DirectionalLight(0xffffff, 1.05)
    key.position.set(2.2, 3.6, 2.4)
    this.scene.add(key)

    // 척(웨이퍼를 붙잡고 도는 원판)
    const chuckGeo = new THREE.CylinderGeometry(0.62, 0.7, 0.3, 48)
    const chuckMat = new THREE.MeshStandardMaterial({
      color: 0x8c949e,
      metalness: 0.6,
      roughness: 0.4,
    })
    const chuck = new THREE.Mesh(chuckGeo, chuckMat)
    chuck.position.y = -0.18
    this.scene.add(chuck)
    this.disposables.push(chuckGeo, chuckMat)

    // 웨이퍼
    const waferGeo = new THREE.CylinderGeometry(WAFER_RADIUS, WAFER_RADIUS, 0.03, 96)
    const waferMat = new THREE.MeshStandardMaterial({
      color: 0xc3c8d0,
      metalness: 0.4,
      roughness: 0.3,
    })
    const waferMesh = new THREE.Mesh(waferGeo, waferMat)
    this.wafer.add(waferMesh)
    this.disposables.push(waferGeo, waferMat)

    // 방향을 알 수 있게 노치 하나
    const notchGeo = new THREE.BoxGeometry(0.1, 0.05, 0.08)
    const notchMat = new THREE.MeshStandardMaterial({ color: 0x6b7482, roughness: 0.6 })
    const notch = new THREE.Mesh(notchGeo, notchMat)
    notch.position.set(0, 0.004, WAFER_RADIUS - 0.02)
    this.wafer.add(notch)
    this.disposables.push(notchGeo, notchMat)
    this.scene.add(this.wafer)

    // 퍼지는 막 — 반지름이 커지는 얇은 원판으로 표현한다
    const filmGeo = new THREE.CircleGeometry(1, 72)
    const filmMat = new THREE.MeshStandardMaterial({
      color: 0xd8b45a,
      transparent: true,
      opacity: 0.85,
      roughness: 0.25,
      metalness: 0.1,
      side: THREE.DoubleSide,
    })
    this.film = new THREE.Mesh(filmGeo, filmMat)
    this.film.rotation.x = -Math.PI / 2
    this.film.position.y = 0.022
    this.film.scale.setScalar(0.001)
    this.wafer.add(this.film)
    this.disposables.push(filmGeo, filmMat)

    // 노즐 + 떨어지는 액 한 방울
    this.nozzle = new THREE.Group()
    const tubeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 20)
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.5, roughness: 0.4 })
    const tube = new THREE.Mesh(tubeGeo, tubeMat)
    tube.position.y = 1.5
    this.nozzle.add(tube)
    this.scene.add(this.nozzle)
    this.disposables.push(tubeGeo, tubeMat)

    const dropGeo = new THREE.SphereGeometry(0.07, 20, 16)
    const dropMat = new THREE.MeshStandardMaterial({ color: 0xd8b45a, roughness: 0.2 })
    this.droplet = new THREE.Mesh(dropGeo, dropMat)
    this.droplet.position.y = 1.2
    this.scene.add(this.droplet)
    this.disposables.push(dropGeo, dropMat)

    this.resize()
  }

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
    this.last = performance.now()
    const loop = (now: number) => {
      if (!this.started) return
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.t = (this.t + dt) % CYCLE_SEC
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

  /** 처음부터 다시 보여준다. */
  replay = (): void => {
    this.t = 0
  }

  private setStage(stage: CoatingStage): void {
    if (this.stage === stage) return
    this.stage = stage
    this.onStage?.(stage)
  }

  private renderFrame(): void {
    const t = this.t

    if (t < STAGE_ENDS.dispense) {
      // 1) 액을 떨어뜨린다 — 노즐 끝에서 웨이퍼 중앙까지 내려온다
      this.setStage('dispense')
      const p = Math.min(1, t / STAGE_ENDS.dispense)
      this.droplet.visible = true
      this.droplet.position.y = 1.2 - p * 1.13
      this.droplet.scale.setScalar(1 - p * 0.25)
      this.film.scale.setScalar(Math.max(0.001, p * 0.12))
      ;(this.film.material as THREE.MeshStandardMaterial).opacity = 0.9
      this.wafer.rotation.y += 0.004
    } else if (t < STAGE_ENDS.spin) {
      // 2) 돌린다 — 원심력으로 퍼진다. 퍼질수록 막은 얇아진다(옅어진다)
      this.setStage('spin')
      const p = (t - STAGE_ENDS.dispense) / (STAGE_ENDS.spin - STAGE_ENDS.dispense)
      this.droplet.visible = false
      const eased = 1 - (1 - p) ** 3
      this.film.scale.setScalar(0.12 + eased * (WAFER_RADIUS * 0.99 - 0.12))
      ;(this.film.material as THREE.MeshStandardMaterial).opacity = 0.9 - eased * 0.45
      this.wafer.rotation.y += 0.05 + eased * 0.5
    } else {
      // 3) 얇고 고른 막이 남는다
      this.setStage('film')
      this.droplet.visible = false
      this.film.scale.setScalar(WAFER_RADIUS * 0.99)
      ;(this.film.material as THREE.MeshStandardMaterial).opacity = 0.45
      this.wafer.rotation.y += 0.12
    }

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose = (): void => {
    this.stop()
    this.controls.dispose()
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost)
    for (const item of this.disposables) item.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}
