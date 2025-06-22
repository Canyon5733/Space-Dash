import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 100000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;

// Ánh sáng
scene.add(new THREE.AmbientLight(0xffffff, 5.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 7);
dirLight.position.set(10, 10, 10);
scene.add(dirLight);

// Load model
/*const loader = new GLTFLoader();
loader.load(
  '/assets/models/ship.glb',
  (gltf) => {
    const model = gltf.scene;
    model.scale.set(10, 10, 10);
    model.position.set(50, 0, 0);
    scene.add(model);

    camera.position.set(0, 0, 100);
    controls.target.set(0, 0, 0);
    controls.update();
  }
);*/

/*const loader1 = new GLTFLoader();
let mixer;

loader1.load(
  '/assets/models/ufo.glb', // ← đường dẫn file glb của bạn
  (gltf) => {
    const model = gltf.scene;
    model.scale.set(10, 10, 10);
    model.position.set(0, 0, 0);
    scene.add(model);

    // Kiểm tra và chạy animation nếu có
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
    }
        camera.position.set(0, 0, 100);
    controls.target.set(0, 0, 0);
    controls.update();
  },
  undefined,
  (error) => {
    console.error('Lỗi khi load model:', error);
  }
);*/


/*camera.position.z = 200;
camera.position.z = 1000; 
camera.position.y = -30000;
const galaxyLight = new THREE.DirectionalLight(0xffffff, 5.0);
galaxyLight.position.set(0, -29500, 400); // chiếu từ trên xuống
galaxyLight.castShadow = true; // ⭐ CHO PHÉP ĐỔ BÓNG

// Cấu hình vùng shadow camera của directional light (giống camera)
galaxyLight.shadow.camera.top = 2000;
galaxyLight.shadow.camera.bottom = -2000;
galaxyLight.shadow.camera.left = -2000;
galaxyLight.shadow.camera.right = 2000;
galaxyLight.shadow.camera.near = 500;
galaxyLight.shadow.camera.far = 10000;
galaxyLight.shadow.mapSize.width = 2048;
galaxyLight.shadow.mapSize.height = 2048;

scene.add(galaxyLight);

// Helper để debug vùng shadow
const shadowCameraHelper = new THREE.CameraHelper(galaxyLight.shadow.camera);
scene.add(shadowCameraHelper);*/
// Optionally, add a soft ambient light for fill
//const ambient = new THREE.AmbientLight(0xffffff, 3.6);
//scene.add(ambient);
/*const debugBox = new THREE.Mesh(
  new THREE.BoxGeometry(500, 500, 500),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
debugBox.position.set(0, -28000, 900);
debugBox.castShadow = true; // đặt cạnh player
scene.add(debugBox);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(5000, 5000, 10, 50),
  new THREE.MeshStandardMaterial({ color: 0xffffff })
);

ground.rotation.x = Math.PI/2;
ground.rotation.z = 0;
ground.position.set(0, -24000, 400); // đặt dưới box một chút
ground.receiveShadow = true; // ⭐ NHẬN BÓNG
scene.add(ground);*/

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  //if (mixer) mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
}
animate();
