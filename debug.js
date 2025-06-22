
// Setup basic scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


// Load galaxy texture
camera.position.z = 1000; 
camera.position.y = -32000;

camera.lookAt( new THREE.Vector3(0,6000,0) );
/*renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const galaxyLight = new THREE.DirectionalLight(0xffffff, 5.0);
galaxyLight.position.set(0, -28000, 3000); // chiếu từ trên xuống
galaxyLight.target.position.set(0, -28000, 0);
galaxyLight.castShadow = true; // ⭐ CHO PHÉP ĐỔ BÓNG

// Cấu hình vùng shadow camera của directional light (giống camera)
galaxyLight.shadow.camera.top = 2000;
galaxyLight.shadow.camera.bottom = -1000;
galaxyLight.shadow.camera.left = -1000;
galaxyLight.shadow.camera.right = 1000;
galaxyLight.shadow.camera.near = 500;
galaxyLight.shadow.camera.far = 10000;
galaxyLight.shadow.mapSize.width = 2048;
galaxyLight.shadow.mapSize.height = 2048;

scene.add(galaxyLight);
scene.add(galaxyLight.target);
// Helper để debug vùng shadow
const shadowCameraHelper = new THREE.CameraHelper(galaxyLight.shadow.camera);
scene.add(shadowCameraHelper);
// Optionally, add a soft ambient light for fill
const ambient = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambient);
const debugBox = new THREE.Mesh(
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

ground.rotation.x = Math.PI/15;
ground.rotation.z = Math.PI;
ground.position.set(0, -28000, 0); // đặt dưới box một chút
ground.receiveShadow = true; // ⭐ NHẬN BÓNG
scene.add(ground);

const lightDebugSphere = new THREE.Mesh(
  new THREE.SphereGeometry(200, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
lightDebugSphere.position.copy(galaxyLight.position);
scene.add(lightDebugSphere);

const arrowHelper = new THREE.ArrowHelper(
  galaxyLight.target.position.clone().sub(galaxyLight.position).normalize(), // hướng
  galaxyLight.position, // gốc
  1000, // chiều dài
  0x00ffff // màu
);
scene.add(arrowHelper);*/

// Add ambient light (so we can see something)
const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
scene.add(ambientLight);
const textureLoader = new THREE.TextureLoader();
const itemTexture = textureLoader.load('/assets/texture/item_ammo1.jpg');
itemTexture.wrapS = THREE.RepeatWrapping;
itemTexture.wrapT = THREE.RepeatWrapping;
itemTexture.repeat.set(1,1);
const geometry = new THREE.CylinderGeometry( 60, 60, 120, 32 );
const material = new THREE.MeshStandardMaterial( { map:itemTexture} ); 
geometry.scale(8,8,8);
const circle = new THREE.Mesh( geometry, material );
circle.position.set(0, -28000, 900);
circle.rotation.y = Math.PI/2;
scene.add( circle );


// Animate
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
