import * as THREE from 'three';
import { deltaTime, thickness } from 'three/tsl';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// --- 1. Các tham số toàn cục ---
var planeDefinition = 20;

let lives = 3;
let kills = 0;
var cx = 0, cy = 0, cz = 0;
let playermoveSpeed = 0.1;
let score = 0;
let bulletsFired = 0;
let highestScore = 0;
let bonusScore = 0;
var enemyattackFrequency = 1000;

let playerAlive = true;
let enemyDead = false;
let isGameStart = false;
let isPaused = false;
let gameStarted = false;
let gameOver = false;

let currentWallX = 99999;

// các vector và trạng thái phím
let bullets = [], enemies = [], exploders = [];
let currentlyPressedKeys = {};

const floatingTexts = [];


// --- 2. Thiết lập scene, camera, renderer ---
const container = document.createElement('div');
document.body.appendChild(container);

var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight,1, 100000)
camera.position.z = 1000; 
camera.position.y = -30000;

camera.lookAt( new THREE.Vector3(0,6000,0) );

var scene = new THREE.Scene();
// Optionally, add a soft ambient light for fill

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);
//camera.lookAt( galaxy.position);
// --- 3. DOM elements ---
const StartText = document.getElementById('Start');
const scoreTextElement = document.getElementById('score');
const GameOverText = document.getElementById('GameOver');
const KillsText = document.getElementById('Kills');
const ScoreText  = document.getElementById('Score');
const HighestScoreText = document.getElementById('HighestScore');
StartText.style.display = 'block';

// --- 4. Resize handler ---

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const loader = new GLTFLoader();
// --- 5. WorldObjects ---
class WorldObjects {
  constructor() {
    this.wallMaterial   = new THREE.MeshStandardMaterial({ color: 0xc175ff, wireframe: true});
    this.shipMaterial   = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 1});
    this.shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5 });
    this.ufoMaterial    = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.tunnelMaterial = new THREE.MeshStandardMaterial({ color: 0x000ff, wireframe: false });
    this.boxesMaterial = new THREE.MeshStandardMaterial({ color: 0xfdd017 });
  }
  Wall() {
    const geom = new THREE.PlaneGeometry( 5000, 2000, 10,10 );
    const mesh = new THREE.Mesh(geom, this.wallMaterial);
    return mesh;
  }
  Ship() {
    return new Promise((resolve, reject) => {
      loader.load(
        '/assets/ship.glb',
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(10, 13, 12);
          resolve(model);
        },
        undefined,
        (error) => {
        reject(error);
        }
      );
    });
}

  shadow() {
    const geom = new THREE.CircleGeometry(30, 16);
    const mesh = new THREE.Mesh(geom, this.shadowMaterial);
    return mesh;
  }
UFO() {
  return new Promise((resolve, reject) => {
    loader.load(
      '/assets/ufo.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(15, 15, 15);
        model.position.set(-50, 0, 0); // Tuỳ chỉnh vị trí ban đầu nếu cần

        let mixer = null;

        // Nếu có animation
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
          });
        }

        // Trả về cả model & mixer để bạn dùng update về sau
        resolve({ model, mixer });
      },
      undefined,
      (error) => {
        console.error('Lỗi khi load UFO model:', error);
        reject(error);
      }
    );
  });
}

  BOX() {
    const geom = new THREE.BoxGeometry(140, 100, 100);
    return new THREE.Mesh(geom, this.boxesMaterial);
  }
  Tunnel() {
    const geom = new THREE.PlaneGeometry(25000, 60000, 3, planeDefinition);
    const mesh = new THREE.Mesh(geom, this.tunnelMaterial);
    return mesh;
  }
}
const Objects = new WorldObjects();

// --- 6. Explode: minimal ---
class Explode {
  constructor(x, y, z) {
    this.totalObjects = 1100;
    const movementSpeed = 40;
    const objectSize = 10;
    this.age = 0;
    this.maxAge = 120;
    this.dirs = [];

    const positions = new Float32Array(this.totalObjects * 3);

    for (let i = 0; i < this.totalObjects; i++) {
      let ix = i * 3;
      positions[ix] = x;
      positions[ix + 1] = y;
      positions[ix + 2] = z;

      this.dirs.push({
        x: (Math.random() * movementSpeed) - (movementSpeed / 2),
        y: (Math.random() * movementSpeed) - (movementSpeed / 2),
        z: (Math.random() * movementSpeed) - (movementSpeed / 2)
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: objectSize,
      color: 0xffffff,
      transparent: true,
      opacity: 1.0
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    this.object = points;
    this.status = true;
  }

  reverse() {
    for (let i = 0; i < this.dirs.length; i++) {
      this.dirs[i].x = -this.dirs[i].x;
      this.dirs[i].y = -this.dirs[i].y;
      this.dirs[i].z = -this.dirs[i].z;
    }
  }

  update() {
    if (this.status && this.age < 2000) {
      this.age++;
      const positions = this.object.geometry.attributes.position.array;

      for (let i = 0; i < this.totalObjects; i++) {
        let ix = i * 3;
        positions[ix] += this.dirs[i].x;
        positions[ix + 1] += this.dirs[i].y;
        positions[ix + 2] += this.dirs[i].z;
      }

      this.object.geometry.attributes.position.needsUpdate = true;
      this.object.material.opacity = 1.0 - this.age / this.maxAge;
    } else if (this.age >= 2000) {
        this.status = false;
    }
  }
}

function CheckExploding(){
  var pCount = exploders.length;
  while(pCount--) {
    if (exploders[pCount].status){
      exploders[pCount].update();
    }
    else
    {
      scene.remove( exploders[pCount] )
    }
  }
}
// --- 7. Player & Enemy ---
class Player {
  constructor() {
    this.status = true;
    this.ship = null;

    Objects.Ship().then((shipModel) => {
      this.ship = shipModel;
      this.ready = true;
      this.ship.rotation.x = 1.56;
      this.ship.position.set(0, -29500, 900);
      this.ship.visible = true;
      scene.add(this.ship);

      // Chỉ định nghĩa các method sau khi ship đã load xong
      this.positionY = () => Math.round(this.ship.position.y);
      this.positionZ = () => Math.round(this.ship.position.z);
      this.positionX = () => Math.round(this.ship.position.x);
      this.turnleft = () => { this.ship.rotation.z = 0.25; };
      this.turnright = () => { this.ship.rotation.z = -0.25; };
    });

    this.shadow = Objects.shadow();
    this.shadow.rotation.x = 1.56;
    this.shadow.position.set(0, -29500, 825);
    scene.add(this.shadow);
  }

  restart() {
    this.ship.position.z = 900; 
    this.ship.position.x = 0;
    cz = 0;
    cy = 0;
    cx = 0;
    this.ship.visible = true;
    this.shadow.visible = true;
  }

  heal() {
    if (lives < 2) {
      const oldLives = lives;
      lives++;
      updateHealthUI(oldLives);
      console.log('Healed! Lives:', lives);
    } 
  }

  ScoreIncrease() {
    const bonus = Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000;
    bonusScore += bonus;
    return bonus;
  }

  ScoreDecrease() {
    const penalty = Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000;
    if (score < penalty) {
      score = 0;
    } else {
      bonusScore -= penalty;
    }
    return penalty;
  }

  dead() {
    if (isGameStart === false) {
      return;
    }

    if (this.status === true) {
      if (lives > 0) {
        const oldLives = lives;
        lives--;
        this.status = false;
        this.ship.visible = false;
        this.shadow.visible = false;
        updateHealthUI(oldLives);
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
          this.ship.visible = !this.ship.visible;
          this.shadow.visible = !this.shadow.visible;
          blinkCount++;
          if (blinkCount >= 10) { 
            clearInterval(blinkInterval);
            this.status = true;
            this.ship.visible = true;
            this.shadow.visible = true;
          }
        }, 100); 
      } else {
        this.status = false;
        this.explosion = new Explode(this.ship.position.x, this.ship.position.y, this.ship.position.z);
        exploders.push(this.explosion);
        this.ship.visible = false;
        this.shadow.visible = false;
        test.stop();
        playerAlive = false;
        gameOver = true;
        if (score > highestScore) {
          highestScore = score;
        }
        GameOverText.style.display = 'block';
        KillsText.innerHTML = "Kills: " + kills;
        ScoreText.innerHTML = "Score: " + score;
        HighestScoreText.innerHTML = "Highest Score: " + highestScore;
        document.getElementById('health').innerHTML = '';
      }
    }
  }
  
  update(deltaTime) {
    if (!this.ship) return;
    this.ship.rotation.z = 0;
    this.ship.position.x -= cx * deltaTime * 50;
    this.ship.position.z -= cy * deltaTime * 50;

    if (!(this.ship.position.x > -400 && this.ship.position.x < 400)) {
      this.ship.position.x += cx;
      cx = 0;
    }

    if (!(this.ship.position.z > 850 && this.ship.position.z < 1050)) {
      this.ship.position.z += cy;
      cy = 0;
    }

    this.shadow.position.x = this.ship.position.x;

  };
}

class Enemy {
  constructor() {
    this.status = false;
    this.mixer = null;
    this.enemyUFO = null;
    this.initialMove = false;

    this.endingX = (Math.random() * 800) - 400;
    this.endingZ = (Math.random() * 200);
  }

  async init() {
    const { model, mixer } = await Objects.UFO();
    this.enemyUFO = model;
    this.mixer = mixer;

    this.enemyUFO.rotation.x = 1.56;
    this.enemyUFO.position.x = (Math.random()*16000) - 8000; 
    this.enemyUFO.position.y = ((Math.random()*124000) -64000);
    this.enemyUFO.position.z = (Math.random()*3000) + 5500; 

    scene.add(this.enemyUFO);
    this.status = true;

    // Position getters
    this.positionX = () => Math.round(this.enemyUFO.position.x);
    this.positionY = () => Math.round(this.enemyUFO.position.y);
    this.positionZ = () => Math.round(this.enemyUFO.position.z);
  }

  dead() {
    this.status = false;
    kills += 1;
    enemyDead = true;
    exploders.push(new Explode(
      this.enemyUFO.position.x,
      this.enemyUFO.position.y,
      this.enemyUFO.position.z
    ));
    this.enemyUFO.position.x = (Math.random()*16000) - 8000; //random from 8000 to -8000
    this.enemyUFO.position.y = ((Math.random()*124000) -64000);
    this.enemyUFO.position.z = (Math.random()*3000) + 5500; //0
    this.endingX = (Math.random() * 800) - 400;
    this.endingZ = (Math.random() * 200);
    this.status = true;
  }

update(deltaTime) {
  if (this.status) {
    if (this.enemyUFO.position.y < -35000) {
      this.status = false;
      this.enemyUFO.position.x = (Math.random()*16000) - 8000; //random from 8000 to -8000
      this.enemyUFO.position.y = ((Math.random()*124000) -64000);
      this.enemyUFO.position.z = (Math.random()*3000) + 5500; //0
    }

    const moveSpeedX = 50 * deltaTime * 60;
    const moveSpeedZ = 20 * deltaTime * 60;
    const epsilon = 5;

    this.initialMove = true;

    // ✅ Sửa logic trục X để không bị giật
    if ((this.enemyUFO.position.x != this.endingX)){
          if(this.enemyUFO.position.x < this.endingX)
            this.enemyUFO.position.x += 50 * deltaTime * 60;
          if(this.enemyUFO.position.x > this.endingX)
            this.enemyUFO.position.x -= 50 * deltaTime * 60;
          
          this.initialMove = false;
        }

    // ✅ Logic di chuyển trục Z
    if (!(this.enemyUFO.position.z < (this.endingZ + 850))) {
      this.enemyUFO.position.z -= moveSpeedZ;
    }

    // ✅ Nếu đã xong initialMove → bay thẳng
    if (this.initialMove) {
      this.enemyUFO.position.x += 100 * deltaTime * 60;
    }

    // ✅ Rơi xuống
    this.enemyUFO.position.y -= ((Math.random() * 30) + 20) * deltaTime * 60;

    // ✅ Cập nhật animation nếu có
    if (this.mixer) this.mixer.update(deltaTime);
    //if (this.enemyUFO.position.y < pl.positionY() + 500) {
    //    this.dead(); // dùng lại hàm dead()
    //}
    console.log(this.enemyUFO.position.x);
    console.log(this.enemyUFO.position.y);
    //console.log(this.enemyUFO.position.z);
  }
}
}

async function EnemyInit() {
  for (let x = 0; x < 1; x++) {
    const xpu = new Enemy();
    await xpu.init(); // đợi load UFO hoàn tất
    enemies.push(xpu);
  }
}


function EnemyLogic(pl, deltaTime) {
  for (let x = 0; x < enemies.length; x++) {
    const enemy = enemies[x];
    enemy.update(deltaTime);

    if (!enemy.status || !enemy.enemyUFO) continue;

    const ex = enemy.positionX();
    const ey = enemy.positionY();
    const ez = enemy.positionZ();

    const px = pl.positionX();
    const py = pl.positionY();
    const pz = pl.positionZ();

    if (ey <= py && ey >= py - 50) {
      if (ez <= pz + 50 && ez >= pz - 50) {
        if (ex <= px + 50 && ex >= px - 50) {
          pl.dead();
          enemy.dead();
        }
      }
    }
  }
}

// --- 8. Item Box ---
const SPAWN_Z         = 1000;    // Tọa độ Z khi spawn item
const DESPAWN_Z       = -200;    // Z thấp hơn ngưỡng này thì item biến mất
const GROUND_Y        = 0;       // Chiều cao cố định của item
const SPAWN_COOLDOWN  = 4.5;     // Thời gian spawn giữa các item
const ITEM_TYPES      = ['heal','multibullets','scoreUp','scoreDown'];
const MIN_DISTANCE_FROM_WALL = 300;

const ITEM_COLORS = {
  heal:      0xff6347, // Cam
  multibullets:    0x00ffff, // Cyan
  scoreUp:   0xffff00, // Vàng
  scoreDown: 0xff0000  // Đỏ
};

class ItemBox {
  constructor() {
    this.mesh = Objects.BOX();
    scene.add(this.mesh);
    this.active = false;
    this.type = null;
  }

  spawn(wallX) {
    const random = Math.random();
    /*if (random < 0.10) {
      this.type = 'heal';
    } 
    else if (random < 0.30) {
      this.type = 'multibullets';
    } 
    else if (random < 0.65) {
      this.type = 'scoreUp';
    } 
    else {
      this.type = 'scoreDown';
    }*/
    this.type = 'heal';
    this.mesh.material.color.setHex(ITEM_COLORS[this.type]);

    let x;
    let attempts = 0;
    do {
      x = -350 + Math.random() * 700;
      attempts++;
      if (attempts > 10) break;
    } while (Math.abs(x - wallX) < MIN_DISTANCE_FROM_WALL);

    this.mesh.position.set(x, GROUND_Y, SPAWN_Z);
    this.speed = 8000 + Math.random() * 200;

    this.active = true;
    this.mesh.visible = true;

    console.log(`Spawned ${this.type} at x=${x.toFixed(1)}, z=${SPAWN_Z}`);
  }

  update(deltaTime) {
    if (!this.active) return;

    this.mesh.position.y -= this.speed * deltaTime;

    if (this.mesh.position.z < DESPAWN_Z) {
      this.active = false;
    }
  }
}

const clock        = new THREE.Clock();
let spawnTimer     = 0;
const items_on_map = [];

function spawnItems(deltaTime) {
  spawnTimer += deltaTime;

  if (spawnTimer >= SPAWN_COOLDOWN) {
    spawnTimer = 0;

    let item = items_on_map.find(i => !i.active);
    if (!item) {
      item = new ItemBox();
      items_on_map.push(item);
    }

    item.spawn(currentWallX);
  }

  items_on_map.forEach(i => i.update(deltaTime));
}

function checkItemCollisionWithPlayer(pl) {
  for (let i = 0; i < items_on_map.length; i++) {
    const item = items_on_map[i];

    if (!item.active) continue;

    const itemX = item.mesh.position.x;
    const itemY = item.mesh.position.y;
    const itemZ = item.mesh.position.z;

    const playerX = pl.positionX();
    const playerY = pl.positionY();
    const playerZ = pl.positionZ();

    const dx = Math.abs(itemX - playerX);
    const dz = Math.abs(itemZ - playerZ);
    const dy = Math.abs(itemY - playerY);

    if (dx < 50 && dz < 50 && dy < 50) {
      console.log(`Player picked up item: ${item.type}`);

      switch(item.type) {
        case 'heal':
          pl.heal();
          floatingTexts.push(new FloatingText(`Player Healed!`, '#ffc0cb', item.mesh.position));
          break;
        case 'multibullets':
          floatingTexts.push(new FloatingText(`Skills Ready!`, '#00ffff', item.mesh.position));
          break;
        case 'scoreUp':
          const bonus = pl.ScoreIncrease(); 
          floatingTexts.push(new FloatingText(`+${bonus}`, '#ffff00', item.mesh.position));
          break;
        case 'scoreDown':
          const penalty = pl.ScoreDecrease();
          floatingTexts.push(new FloatingText(`-${penalty}`, '#ff0000', item.mesh.position));
          break;
      }

      item.active = false;
      item.mesh.visible = false;
    }
  }
}

// --- 9. Level Background ---
let moveStep;
class LevelBackground {
  constructor() {
    this.floorVisible = true;
    this.closingWall = true;  
    this.flat = false;
    this.stars = true;
    this.movespeed = 25000;
  
    this.distanceTravelled = 0;
    
    this.floor = Objects.Tunnel();
    this.floor1 = Objects.Tunnel();
    this.floor2 = Objects.Tunnel();

    this.floor1.position.y = 60000;
    this.floor2.position.y = 120000;
    
    if (!this.floorVisible)
    {
      this.floor.visible = false;
      this.floor1.visible = false;
      this.floor2.visible = false;
    }
  
    if(this.closingWall)
    {
      this.wall = Objects.Wall();
      this.wall.rotation.x = 1.56;
      this.wall.position.x = 6000; //2500
      this.wall.position.y = 70000;
      this.wall.position.z = 950;
    }
      this.wallY = function() { return Math.round(this.wall.position.y) ;}
      this.wallZ = function() { return Math.round(this.wall.position.z) ;}
      this.wallX = function() { return Math.round(this.wall.position.x) ;}
 
  if(!this.flat){
    makeWalls(this.floor);
    makeWalls(this.floor1);
    makeWalls(this.floor2);
  }
    scene.add(this.wall);
    scene.add(this.floor);
    scene.add(this.floor1);
    scene.add(this.floor2);
  
  if(this.stars)
    createStars();
  
  this.restart = function()
  {
    this.movespeed = 25000;
    this.update(deltaTime);
  }
    
  this.stop = function()
  {
    this.movespeed = 0;
  }

  }

  update(deltaTime) {
    moveStep = this.movespeed * deltaTime;
    this.floor.position.y -= moveStep;
    this.floor1.position.y -= moveStep;
    this.floor2.position.y -= moveStep;
    this.distanceTravelled += moveStep * 5;
    if(this.floor.position.y < -60000)
    {
      this.floor.position.y = 120000;
      
    }
    if(this.floor1.position.y < -60000)
    {
      this.floor1.position.y = 120000;
      
    }
     if(this.floor2.position.y < -60000)
    {
      this.floor2.position.y = 120000;
      
    }
  
    if(this.closingWall)
    {
      this.wall.position.y -= moveStep;
      if(this.wall.position.x > 2500)
        {this.wall.position.x -= 10;}
      else if (this.wall.position.x < -2500)
        {this.wall.position.x += 10;}
    
      if (this.wall.position.y < -29600)
      {
        this.wall.position.y = 70000; 
        this.wall.position.x = 6000 * wallLocation();
      }
    }
    updateStars(performance.now());
    currentWallX = this.wall.position.x;
  }

  getDistance() {
    return this.distanceTravelled;
  }
}

function wallLocation()
{
  let wx = Math.round(Math.random()*1);
  if (wx==0)
    return -1;
  else if (wx==1)
    return 1;
}

let starParticles, starMaterial, starGeometry;

function createStars() {
  const starCount = 500;
  const positions = new Float32Array(starCount * 3);
  const opacities = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * 110000 - 55000;
    const y = 40000;
    const z = Math.random() * 80000 - 40000;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    opacities[i] = Math.random(); // Tạo opacity ngẫu nhiên ban đầu
  }

  starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

  const vertexShader = `
    attribute float aOpacity;
    varying float vOpacity;
    void main() {
      vOpacity = aOpacity;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = 1.8;
    }
  `;

  const fragmentShader = `
    varying float vOpacity;
    void main() {
      float d = distance(gl_PointCoord, vec2(0.5));
      if (d > 0.5) discard;
      gl_FragColor = vec4(vec3(1.0), vOpacity);
    }
  `;

  starMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false
  });

  starParticles = new THREE.Points(starGeometry, starMaterial);
  starParticles.position.z = 5400;
  starParticles.position.y = -20000;
  starParticles.rotation.x -= 0.31;

  scene.add(starParticles);
}

function updateStars(time) {
  const opacities = starGeometry.attributes.aOpacity.array;
  for (let i = 0; i < opacities.length; i++) {
    opacities[i] = 0.5 + 0.5 * Math.sin(time * 0.001 + i); 
  }
  starGeometry.attributes.aOpacity.needsUpdate = true;
}

function makeWalls(plane) { 
  const positionAttr = plane.geometry.attributes.position;
  const posArray = positionAttr.array;

  for (let i = 0; i < posArray.length; i += 3) {
    const x = posArray[i];      
    const y = posArray[i + 1];   
    const z = posArray[i + 2];   

    if (x === -12500) {
      posArray[i] = -4150;       
      posArray[i + 2] = 2000;    
    }
    if (x === 12500) {
      posArray[i] = 4150;        
      posArray[i + 2] = 2000;    
    }
  }

  positionAttr.needsUpdate = true;
  plane.geometry.computeVertexNormals(); 
}


function WallCollision(pl, test) {
  if (!pl.ready) return; 
  const playerY = pl.positionY(); 
  const wallY = test.wallY();

  const collisionThreshold = 800; 
  
  if (Math.abs(playerY - (wallY - 1500)) <= collisionThreshold) {
    if ((pl.positionX() <= (0) && pl.positionX() >= (test.wallX())) || (pl.positionX() >= (0) && pl.positionX() <= (test.wallX()))) 
    {
        pl.dead();
    }
  }
}

// --- 10. Bullet ---
const MAX_BULLETS = 20;      
let remainingBullets = MAX_BULLETS;
let lastShotTime = 0;
const shootCooldown = 350;
const reloadTime = 2000; 
let isReloading = false;

function bulletsInit(total) {
  for (var x = 0; x < total; x++)
    {
      var bullet;
      bullet = new THREE.Mesh(new THREE.SphereGeometry(5,10,10), new THREE.MeshBasicMaterial({  wireframe:false, color:'#A00404' }));
      bullet.visible = false;
      scene.add(bullet);
      bullets.push(bullet);
      bullet.velocity = new THREE.Vector3(0, 1, 0);
    }
}

function shoot()
{
  const now = Date.now();
  if (now - lastShotTime < shootCooldown) {
    return; 
  }

  for (let i = 0; i < bullets.length; i++) {
    if (!bullets[i].visible) {
      lastShotTime = now;
      bullets[i].visible = true;
      bullets[i].position.set(pl.positionX(), pl.positionY(), pl.positionZ());
      remainingBullets--; 
      updateAmmoUI();
      return;
    }
  }
}

function bulletCreating(bullets) {
  for (let x = 0; x < bullets.length; x++) {
    const bullet = bullets[x];

    if (bullet.visible) {
      // Di chuyển đạn theo vector velocity
      bullet.position.add(bullet.velocity.clone().multiplyScalar(50));

      // Nếu vượt giới hạn thì reset đạn
      if (bullet.position.y > -25000) {
        bullet.visible = false;
        bullet.position.set(0, 0, 0);
        bullet.velocity = new THREE.Vector3(0, 1, 0); // reset hướng đạn thẳng đứng
        continue;
      }

      // Kiểm tra va chạm với enemy
      for (let e = 0; e < enemies.length; e++) {
        const enemy = enemies[e];
        if (enemy.status) {
          const enemyPos = new THREE.Vector3(enemy.positionX(), enemy.positionY(), enemy.positionZ());
          const distance = bullet.position.distanceTo(enemyPos);

          if (distance <= 60) { // 50 là bán kính va chạm, có thể điều chỉnh
            enemy.dead();
            bonusScore += 2000;

            bullet.visible = false;
            bullet.position.set(0, 0, 0);
            bullet.velocity = new THREE.Vector3(0, 1, 0);
            break;
          }
        }
      }
    }
  }
}

function AutoReloadBullet() {
  if (remainingBullets === 0 && !isReloading)
  {
    isReloading = true;
    updateReloadUI(true); 
    setTimeout(() => {
    remainingBullets = MAX_BULLETS;
    isReloading = false;
    updateAmmoUI();
    updateReloadUI(false); 
    }, reloadTime);
  }
}

// --- 11. Player Skills ---

function MultiBullets() {
  const now = Date.now();
  if (now - lastShotTime < shootCooldown || isReloading) return;

  const spread = 0.02;
  const directions = [
  new THREE.Vector3(-2 * spread, 1, 0),
  new THREE.Vector3(-1 * spread, 1, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(1 * spread, 1, 0),
  new THREE.Vector3(2 * spread, 1, 0),
  ];

  let bulletsFired = 0;
  for (let i = 0; i < bullets.length && bulletsFired < directions.length; i++) {
    const bullet = bullets[i];
    if (!bullet.visible) {
      bullet.visible = true;
      bullet.position.set(pl.positionX(), pl.positionY(), pl.positionZ());
      bullet.velocity = directions[bulletsFired].clone().normalize(); 
      bulletsFired++;
    }
  }

  if (bulletsFired > 0) {
    remainingBullets -= bulletsFired;
    lastShotTime = now;
    updateAmmoUI();
  }
}

// --- 12. Functions Handler ---
class FloatingText {
  constructor(text, color, position3D) {
    this.div = document.createElement('div');
    this.div.className = 'floating-text';
    this.div.textContent = text;
    this.div.style.color = color;
    document.body.appendChild(this.div);

    this.position3D = position3D.clone();
    this.lifetime = 2.0;
    this.age = 0;
  }

  update(delta, camera) {
    console.log("Updating floating text", this.age.toFixed(2));
    this.age += delta;
    if (this.age > this.lifetime) {
      this.div.remove();
      return false;
    }

    this.position3D.z += delta * 50;

    const projected = this.position3D.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

    this.div.style.left = `${x}px`;
    this.div.style.top = `${y}px`;

    const alpha = 1 - (this.age / this.lifetime);
    this.div.style.opacity = alpha;

    return true;
  }
}

// --- 11. Start & render ---
let pl;
let test;
function start() {
  scene.clear();
  enemies = [];
  bullets = [];
  exploders = [];
  lives = 2;
  bulletsFired = 0;
  kills = 0;
  playerAlive = true;
  gameOver = false;
  score = 0;
  bonusScore = 0;
  pl = new Player();
  test = new LevelBackground();
  bulletsInit(300);
  EnemyInit();
  StartText.style.display = 'none';
  const ambient = new THREE.AmbientLight(0xffffff, 3.5);
  scene.add(ambient);
}

function GameController(pl ,test) {
  let deltaTime = clock.getDelta();
  deltaTime = Math.min(deltaTime, 0.033);

  if(PauseMenuHandle(scene, camera)) return;

  AutoReloadBullet();

  pl.update(deltaTime);
  test.update(deltaTime);

  handleKeys();
  GameStart(pl, test, deltaTime);
  bulletCreating(bullets);

  checkItemCollisionWithPlayer(pl);
  CheckExploding();
  WallCollision(pl, test);

  FloatingTextHandle();
}

function PauseMenuHandle(scene, camera){
    if (isPaused) {
    renderer.render(scene, camera);
    document.getElementById('PauseMenu').style.display = 'block';
    return true;
    }
    else
    {
      document.getElementById('PauseMenu').style.display = 'none';
      return false;
    }
}

function FloatingTextHandle()
{
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const alive = floatingTexts[i].update(1/60, camera);
    if (!alive) {
      floatingTexts.splice(i, 1);
    }
  }
}
function GameStart(pl, test, deltaTime){
  if (playerAlive == true && isGameStart == true){
    EnemyLogic(pl, deltaTime);
    spawnItems(deltaTime);
    let travelled = test.getDistance();
    score = Math.floor(travelled / 100) + bonusScore; 
    scoreTextElement.innerText = "Score: " + score;
  }
}
function render() {
  requestAnimationFrame(render);
  let deltaTime = clock.getDelta();
  deltaTime = Math.min(deltaTime, 0.033);

  if(PauseMenuHandle(scene, camera)) return;

  AutoReloadBullet();

  pl.update(deltaTime);
  test.update(deltaTime);

  handleKeys();
  GameStart(pl, test, deltaTime);
  bulletCreating(bullets);

  checkItemCollisionWithPlayer(pl);
  CheckExploding();
  WallCollision(pl, test);

  FloatingTextHandle();

  renderer.render(scene, camera);
}

// --- 10. Sự kiện phím ---
document.addEventListener('keydown', e => {
  currentlyPressedKeys[e.code] = true;
    if (e.code === 'Space') {
      if (!gameStarted)
      {
        gameStarted = true;
      }
      start();
      UIReset();
    }
    if (currentlyPressedKeys['Enter'] || currentlyPressedKeys['NumpadEnter']) {
      if (playerAlive == true && isPaused == false)
      {
        if (remainingBullets > 0)
            shoot();
      }
    }
    if (e.code === 'KeyQ') {
      if (remainingBullets >= 5)
      {
        MultiBullets();
      }
    }
    if (e.code === 'KeyE')
    {
        test.stop();
    }
    if (e.key === "Escape") {
      if (gameStarted)
      {
        isPaused = !isPaused;
      }
    }
});
document.addEventListener('keyup', e => {
  currentlyPressedKeys[e.code] = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameStarted && !gameOver) {
    isPaused = true;
  }
});

function UIReset() {
  GameOverText.style.display = 'none';
  remainingBullets = MAX_BULLETS;
  updateAmmoUI();
  updateHealthUI();
  isGameStart = true;
}

function updateHealthUI(previousLives = 0) {
  const health = document.getElementById('health');
  const currentHearts = health.children.length;

  if (lives > currentHearts - 1) {
    const heart = document.createElement('span');
    heart.innerText = '❤️';
    heart.classList.add('heart', 'heal');
    health.insertBefore(heart, health.firstChild); 
  }

  else if (lives < currentHearts - 1) {
    const firstHeart = health.firstChild;
    if (firstHeart) {
      firstHeart.classList.add('lose');
      setTimeout(() => {
        firstHeart.remove();
      }, 500); 
    }
  }

  else {
    health.innerHTML = '';
    for (let i = 0; i <= lives; i++) {
      const heart = document.createElement('span');
      heart.innerText = '❤️';
      heart.classList.add('heart');
      health.appendChild(heart);
    }
  }
}

function updateAmmoUI() {
  const ammoEl = document.getElementById("ammoCount");
  const ammoBox = document.getElementById("ammo");

  ammoEl.innerText = remainingBullets;

  if (remainingBullets <= 5) {
    ammoBox.classList.add("low-ammo");
  } else {
    ammoBox.classList.remove("low-ammo");
  }
}

function updateReloadUI(isReloading) {
  const reloadText = document.getElementById("reloadUI");
  if (reloadText) {
    reloadText.style.display = isReloading ? "block" : "none";
  }
}

function handleKeys() {
  if (currentlyPressedKeys['KeyA']) {
    pl.turnleft()
    cx += playermoveSpeed;
  }
  if (currentlyPressedKeys['KeyD']) {
     pl.turnright()
    cx -= playermoveSpeed;
  }
  if (currentlyPressedKeys['KeyW']) {
    cy -= playermoveSpeed;
  }
  if (currentlyPressedKeys['KeyS']) {
    cy += playermoveSpeed;
  }
}

// Chạy game
start();
render();



// Task cần làm:
// Cài lại cái bảng UI/UX bắt đầu game, restart game, hiện kết quả
// Chỉnh lại spawnrate của Enemy, thời gian xuất hiện ItemBox lâu hơn
// Update lại cái spawn của cái tường, cũng như là cái itemBox nó xuất hiện sao cho cách cái tường ra một xí
// Tạo asset cho Ship, Enemy, Level 
// Tạo thêm cái Laser xuất hiện để player né (khác tường)
// Góp ý của thầy:
// Nên thêm nhiều kiểu Enemy hơn cho nó đỡ bị đơn điệu
// Thêm chức năng Pause Game
// Thêm âm thanh
// Bug collision Wall
// Cái cần thiết: Tạo Directional Light cho scene -> Đây là cái thầy yêu cầu phải làm