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

let listener, audioLoader;
let mainMusic, levelMusic;

// --- 2. Thiết lập scene, camera, renderer ---
const container = document.createElement('div');
document.body.appendChild(container);

var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 50, 80000)
camera.position.z = 1000; 
camera.position.y = -30000;

camera.lookAt( new THREE.Vector3(0,6000,0) );
var scene = new THREE.Scene();

initAudio();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
container.appendChild(renderer.domElement);

// --- 3. DOM elements ---
const StartText = document.getElementById('Start');
const scoreTextElement = document.getElementById('score');
const GameOverText = document.getElementById('GameOver');
const KillsText = document.getElementById('Kills');
const ScoreText  = document.getElementById('Score');
const HighestScoreText = document.getElementById('HighestScore');

const settingsBtn = document.getElementById('settingsBtn');
const settingsPopup = document.getElementById('settingsPopup');
const closeSettings = document.getElementById('closeSettings');
const muteCheckbox = document.getElementById('muteCheckbox');
StartText.style.display = 'block';

// --- 4. Resize handler ---

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const spaceTexture = textureLoader.load('./assets/texture/anothertunnel.jpg');
const wallTexture = textureLoader.load('./assets/texture/wall.jpg');

spaceTexture.wrapS = THREE.RepeatWrapping;
spaceTexture.wrapT = THREE.RepeatWrapping;
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;

wallTexture.repeat.set(2, 1);
spaceTexture.repeat.set(1, 3); 

const healTexture = textureLoader.load('./assets/texture/item_heal.png');
healTexture.wrapS = THREE.RepeatWrapping;
healTexture.wrapT = THREE.RepeatWrapping;
healTexture.repeat.set(1,2);

const bulletTexture = textureLoader.load('./assets/texture/item_ammo1.jpg');

const scoreTexture = textureLoader.load('./assets/texture/item_score.png');

spaceTexture.generateMipmaps = true;
spaceTexture.minFilter = THREE.LinearMipMapLinearFilter;
spaceTexture.magFilter = THREE.LinearFilter;
spaceTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

// --- 5. WorldObjects ---
class WorldObjects {
  constructor() {
    this.wallMaterial   = new THREE.MeshStandardMaterial({ map: wallTexture});
    this.tunnelMaterial = new THREE.MeshStandardMaterial({ map:spaceTexture , side: THREE.DoubleSide});
    this.boxesMaterial = new THREE.MeshStandardMaterial({ color: 0xfdd017 });
  }
  Wall() {
    const geom = new THREE.PlaneGeometry( 5500, 2000, 500 );
    const mesh = new THREE.Mesh(geom, this.wallMaterial);
    mesh.material.transparent = false; 
    mesh.material.depthWrite = true;
    mesh.material.depthTest = true;
    return mesh;
  }
  Ship() {
    return new Promise((resolve, reject) => {
      loader.load(
        './assets/models/ship.glb',
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(10, 13, 12);
          model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true; 
          }
        });
          resolve(model);
        },
        undefined,
        (error) => {
        reject(error);
        }
      );
    });
}

shipShadow(originalShip) {
  const shadow = originalShip.clone();

  shadow.traverse(child => {
    if (child.isMesh) {
      child.material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        depthWrite: false 
      });
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  shadow.scale.y = 0.01;
  shadow.scale.x *= 0.95;
  shadow.scale.z *= 0.95;

  return shadow;
}
  UFO() {
    return new Promise((resolve, reject) => {
      loader.load(
        './assets/models/ufo.glb',
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(20, 20, 20);

        const outline = model.clone();
        outline.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshBasicMaterial({
              color: 0x000000,
              side: THREE.BackSide 
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        outline.scale.multiplyScalar(1.08);

          model.add(outline);
          let mixer = null;
          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach((clip) => {
              mixer.clipAction(clip).play();
            });
          }
          resolve({ model, mixer });
        },
        undefined,
        (error) => {
          console.error('Error', error);
          reject(error);
        }
      );
    });
  }
  ScoreItem() {
    const geom = new THREE.BoxGeometry(150, 100, 120);
    const material = new THREE.MeshBasicMaterial( {map:scoreTexture} ); 
    return new THREE.Mesh(geom, material);
  }
  HealItem(){
    const geometry = new THREE.CapsuleGeometry( 45, 40, 4, 8 ); 
    const material = new THREE.MeshBasicMaterial( {map:healTexture} ); 
    return new THREE.Mesh( geometry, material );
  }
  BulletItem(){
    const geometry = new THREE.CylinderGeometry( 60, 60, 120, 32 ); 
    const material = new THREE.MeshBasicMaterial( {map:bulletTexture, color: 0xffffff} ); 
    return new THREE.Mesh( geometry, material );  
  }
  Tunnel() {
    const geom = new THREE.PlaneGeometry(25000, 60000, 3, planeDefinition);
    const mesh = new THREE.Mesh(geom, this.tunnelMaterial);
    mesh.transparent = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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
      this.shadow = Objects.shipShadow(this.ship);
      this.shadow.rotation.x = 1.56;
      this.shadow.position.set(0,-29500,825);
      scene.add(this.shadow);
      this.positionY = () => Math.round(this.ship.position.y);
      this.positionZ = () => Math.round(this.ship.position.z);
      this.positionX = () => Math.round(this.ship.position.x);
      this.turnleft = () => { this.ship.rotation.z = 0.25; };
      this.turnright = () => { this.ship.rotation.z = -0.25; };
    });
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
    } 
  }

  bulletRefill() {
    remainingBullets = MAX_BULLETS;
    updateAmmoUI();
  }

  ScoreIncrease() {
    const bonus = Math.floor(Math.random() * (6000 - 1000 + 1)) + 1000;
    bonusScore += bonus;
    return bonus;
  }

  ScoreDecrease() {
    const penalty = Math.floor(Math.random() * (6000 - 1000 + 1)) + 1000;
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
        TakeDameSound();
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
        gameOverSound();
        if (levelMusic && levelMusic.isPlaying) {
          levelMusic.stop();
        }
        this.status = false;
        this.explosion = new Explode(this.ship.position.x, this.ship.position.y, this.ship.position.z);
        exploders.push(this.explosion);
        this.ship.visible = false;
        this.shadow.visible = false;
        test.stop();
        playerAlive = false;
        gameOver = true;
        gameStarted = false;
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

    if (!(this.ship.position.x > -450 && this.ship.position.x < 450)) {
      this.ship.position.x += cx;
      cx = 0;
    }

    if (!(this.ship.position.z > 850 && this.ship.position.z < 1050)) {
      this.ship.position.z += cy;
      cy = 0;
    }

    if (this.shadow && this.ship) {
      this.shadow.position.x = this.ship.position.x;
    }
  };
}

class Enemy {
  constructor() {
    this.initialMove = false;
    this.endingX = (Math.random()*800) - 400;
    this.endingZ = (Math.random()*200);
    this.status = false;
    this.enemyUFO = null;
    this.mixer = null;

    Objects.UFO().then(({ model, mixer }) => {
      this.enemyUFO = model;
      this.enemyUFO.renderOder = 2;
      this.mixer = mixer;
      this.enemyUFO.rotation.x = 1.56;
      this.enemyUFO.position.x = (Math.random()*16000) - 8000; 
      this.enemyUFO.position.y = ((Math.random()*124000) -64000);
      this.enemyUFO.position.z = (Math.random()*3000) + 5500; 
      scene.add(this.enemyUFO);

      this.positionY = () => Math.round(this.enemyUFO.position.y);
      this.positionZ = () => Math.round(this.enemyUFO.position.z);
      this.positionX = () => Math.round(this.enemyUFO.position.x);
    });
  }

  dead() {
      this.status = false;
      exploders.push(new Explode(this.enemyUFO.position.x, this.enemyUFO.position.y,this.enemyUFO.position.z));
      this.enemyUFO.position.x = (Math.random()*16000) - 8000; //random from 8000 to -8000
      this.enemyUFO.position.y = ((Math.random()*124000) -64000);
      this.enemyUFO.position.z = (Math.random()*3000) + 5500; //0
      kills += 1;
      enemyDead = true;
  }
  update(deltaTime) {
    if (!this.enemyUFO) return;
    if(this.status == true){
      if(this.enemyUFO.position.y < -35000)
      {
          this.status = false;
          this.enemyUFO.position.x = (Math.random()*16000) - 8000; //random from 8000 to -8000
          this.enemyUFO.position.y = ((Math.random()*124000) -64000);
          this.enemyUFO.position.z = (Math.random()*3000) + 5500; //0
      }
      this.initialMove = true;
        if ((this.enemyUFO.position.x != this.endingX)){
          if(this.enemyUFO.position.x < this.endingX)
            this.enemyUFO.position.x += 50 * deltaTime * 60;
          if(this.enemyUFO.position.x > this.endingX)
            this.enemyUFO.position.x -= 50 * deltaTime * 60;
          
          this.initialMove = false;
        }
       
        if (!(this.enemyUFO.position.z < (this.endingZ + 850) )){
             this.enemyUFO.position.z -= 20 * deltaTime * 60; 
        }
        if (this.initialMove == true)
        {
          this.enemyUFO.position.x += 100 * deltaTime * 60;
        }
          this.enemyUFO.position.y -= ((Math.random()*30)+20) * deltaTime * 60;
        if (this.mixer) this.mixer.update(deltaTime);
      }
  }
}

function EnemyInit() {
  for (var x = 0; x < 15; x++)
  {
      let xpu = new Enemy();
      enemies.push(xpu);
  }
}

function EnemyLogic(pl, deltaTime) {
  for(var x = 0; x < enemies.length; x++)
  {
    enemies[x].update(deltaTime);
    if (enemies[x].status){
    
    if (enemies[x].positionY() <= pl.positionY() && enemies[x].positionY() >= pl.positionY() - 50)
    {
      if (enemies[x].positionZ() <= pl.positionZ()+50 && enemies[x].positionZ() >= pl.positionZ() - 50)
      {
        if (enemies[x].positionX() <= pl.positionX()+50 && enemies[x].positionX() >= pl.positionX() - 50)
        {
            pl.dead();
            enemies[x].dead();
        }
      }
    }
    }
    else
    {
      if(Math.round((Math.random()* enemyattackFrequency)) == 1) 
          enemies[x].status = true;
    }
  }
}


// --- 8. Item Box ---
const SPAWN_Z         = 1000;    
const DESPAWN_Z       = -200;    
const GROUND_Y        = 0;       
const SPAWN_COOLDOWN  = 4.5;     
const ITEM_TYPES      = ['heal','bullets','scoreUp','scoreDown'];
const MIN_DISTANCE_FROM_WALL = 300;

class ItemBox {
  constructor() {
    this.mesh = null;
    this.active = false;
    this.type = null;
  }

  spawn(wallX) {
    const random = Math.random();
    if (random < 0.10) {
      this.type = 'heal';
      this.mesh = Objects.HealItem();
      this.mesh.rotation.x = Math.PI/2;
    } 
    else if (random < 0.30) {
      this.type = 'bullets';
      this.mesh = Objects.BulletItem();
      this.mesh.rotation.y = Math.PI/2;
    } 
    else if (random < 0.65) {
      this.type = 'scoreUp';
      this.mesh = Objects.ScoreItem();
    } 
    else {
      this.type = 'scoreDown';
      this.mesh = Objects.ScoreItem();
    }
    scene.add(this.mesh);

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

    //console.log(`Spawned ${this.type} at x=${x.toFixed(1)}, z=${SPAWN_Z}`);
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
    if (
    !pl ||
    typeof pl.positionX !== 'function' ||
    typeof pl.positionY !== 'function' ||
    typeof pl.positionZ !== 'function'
  ) {
    return;
  }
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

    if (dx < 75 && dz < 75 && dy < 75) {
      switch(item.type) {
        case 'heal':
          RegenerateSound();
          pl.heal();
          floatingTexts.push(new FloatingText(`Player Healed!`, '#ffc0cb', item.mesh.position));
          break;
        case 'bullets':
          ItemSound();
          pl.bulletRefill();
          floatingTexts.push(new FloatingText(`Ammo Refilled!`, '#00ffff', item.mesh.position));
          break;
        case 'scoreUp':
          ItemSound();
          const bonus = pl.ScoreIncrease(); 
          floatingTexts.push(new FloatingText(`+${bonus}`, '#ffff00', item.mesh.position));
          break;
        case 'scoreDown':
          ItemSound();
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
      this.wall.renderOder = 1;
      this.wall.rotation.x = 1.56;
      this.wall.position.x = 7000; //2500
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
      if(this.wall.position.x > this.wallTargetX)
        {this.wall.position.x -= 10;}
      else if (this.wall.position.x < -this.wallTargetX)
        {this.wall.position.x += 10;}
    
      if (this.wall.position.y < -29600)
      {
        this.wall.position.y = 75000; 
        this.wall.position.x = 7000 * wallLocation();
        this.wallTargetX = 1700 + Math.random() * (3500 - 1000); 
        //console.log(this.wallTargetX);
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
  const starCount = 550;
  const positions = new Float32Array(starCount * 3);
  const opacities = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * 110000 - 55000;
    const y = 40000;
    const z = Math.random() * 80000 - 40000;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    opacities[i] = Math.random(); 
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
      gl_PointSize = 2.5;
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

  const collisionThresholdY = 800; 
  const wallX = test.wallX();      
  const wallWidth = 5500;
  //console.log(wallX);
  if (Math.abs(playerY - (wallY - 1500)) <= collisionThresholdY) {

    const playerX = pl.positionX();
    if (wallX < 0) 
    {
      const borderX = (wallX + (wallWidth)/2)/10;
      if (wallX < playerX && playerX < borderX)
      {
          pl.dead(); 
      }
    }
    else
    {
      const borderX = (wallX - (wallWidth)/2)/10;
      if (borderX < playerX && playerX < wallX)
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
      playGunshot();
      remainingBullets--; 
      updateAmmoUI();
      return;
    }
  }
}

function playGunshot() {
  const gunshot = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();
  loader.load('./assets/audio/gunshot.wav', function(buffer) {
    gunshot.setBuffer(buffer);
    gunshot.setVolume(0.7);
    gunshot.play();
  });
}

function bulletCreating(bullets) {
  for (let x = 0; x < bullets.length; x++) {
    const bullet = bullets[x];

    if (bullet.visible) {
      bullet.position.add(bullet.velocity.clone().multiplyScalar(50));

      if (bullet.position.y > -25000) {
        bullet.visible = false;
        bullet.position.set(0, 0, 0);
        bullet.velocity = new THREE.Vector3(0, 1, 0); 
        continue;
      }

      // Kiểm tra va chạm với enemy
      for (let e = 0; e < enemies.length; e++) {
        const enemy = enemies[e];
        if (enemy.status) {
          const enemyPos = new THREE.Vector3(enemy.positionX(), enemy.positionY(), enemy.positionZ());
          const distance = bullet.position.distanceTo(enemyPos);

          if (distance <= 80) { 
            enemy.dead();
            playEnemyDead();
            bonusScore += 4000;

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
    ReloadSound();
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
      playGunshot();
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

  const galaxyLight = new THREE.DirectionalLight(0xffffff, 3.5);
  galaxyLight.position.set(0, -28500, 1200); // chiếu từ trên xuống
  galaxyLight.castShadow = true; // ⭐ CHO PHÉP ĐỔ BÓNG
  galaxyLight.target.position.set(0,-29500, 400);


  galaxyLight.shadow.camera.top = 2000;
  galaxyLight.shadow.camera.bottom = -1000;
  galaxyLight.shadow.camera.left = -2500;
  galaxyLight.shadow.camera.right = 2500;
  galaxyLight.shadow.camera.near = 1000;
  galaxyLight.shadow.camera.far = 3000;
  galaxyLight.shadow.mapSize.width = 2048;
  galaxyLight.shadow.mapSize.height = 2048;

  scene.add(galaxyLight);
  scene.add(galaxyLight.target);
  
  /*const lightMarkerGeometry = new THREE.SphereGeometry(10, 32, 32); // bán kính 100
  const lightMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // màu vàng
  const lightMarker = new THREE.Mesh(lightMarkerGeometry, lightMarkerMaterial);
  lightMarker.position.copy(galaxyLight.position);
  scene.add(lightMarker);
  // Helper để debug vùng shadow
  const shadowCameraHelper = new THREE.CameraHelper(galaxyLight.shadow.camera);
  scene.add(shadowCameraHelper); */
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
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

// --- Audio Handler ---
function initAudio() {
  listener = new THREE.AudioListener();
  camera.add(listener);

  audioLoader = new THREE.AudioLoader();

  mainMusic = new THREE.Audio(listener);
  audioLoader.load('./assets/audio/themusic.mp3', (buf) => {
    mainMusic.setBuffer(buf);
    mainMusic.setLoop(true);
    mainMusic.setVolume(1.0);
  });


  levelMusic = new THREE.Audio(listener);
  audioLoader.load('./assets/audio/levelbackground.wav', (buf) => {
    levelMusic.setBuffer(buf);
    levelMusic.setLoop(true);
    levelMusic.setVolume(0.5);
  });
}

function swapSoundtracks() {
  if (mainMusic && mainMusic.isPlaying) {
    mainMusic.stop();    
  }

  if (levelMusic && !levelMusic.isPlaying) {
    levelMusic.play();     
  }
}

function playEnemyDead() {
  const enemyDeadSound = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();
  loader.load('./assets/audio/enemydead.wav', function(buffer) {
    enemyDeadSound.setBuffer(buffer);
    enemyDeadSound.setVolume(0.7);
    enemyDeadSound.play();
  });
}

function gameOverSound() {
  const gameOverSound = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();
  loader.load('./assets/audio/gameOver.wav', function(buffer) {
    gameOverSound.setBuffer(buffer);
    gameOverSound.setVolume(0.7);
    gameOverSound.play();
  });
}

function RegenerateSound() {
  const regenerate = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();
  loader.load('./assets/audio/health-regenerate.wav', function(buffer) {
    regenerate.setBuffer(buffer);
    regenerate.setVolume(0.7);
    regenerate.play();
  });
}

function ItemSound() {
  const itemSound = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();
  loader.load('./assets/audio/itempickup.wav', function(buffer) {
    itemSound.setBuffer(buffer);
    itemSound.setVolume(0.7);
    itemSound.play();
  });
}

function TakeDameSound() {
  const dameSound = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();
  loader.load('./assets/audio/takedamage.wav', function(buffer) {
    dameSound.setBuffer(buffer);
    dameSound.setVolume(0.7);
    dameSound.play();
  });
}

function ReloadSound() {
  const reloadSound = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();
  loader.load('./assets/audio/reload.wav', function(buffer) {
    reloadSound.setBuffer(buffer);
    reloadSound.setVolume(0.7);
    reloadSound.play();
  });
}

let lastQSkillTime = 0; 
const Q_SKILL_COOLDOWN = 3000;
let firstInteraction = true;
// --- 10. Sự kiện phím ---
document.addEventListener('keydown', e => {
  currentlyPressedKeys[e.code] = true;
    if (e.code === 'Space') {
      if (THREE.AudioContext.getContext().state === 'suspended') {
        THREE.AudioContext.getContext().resume();
      }

      if (firstInteraction) {
        mainMusic.play();
        firstInteraction = false;
        return;     
      }

      swapSoundtracks();   
      if (!gameStarted)
      {
        gameStarted = true;
        start();
        UIReset();
      }
    }
    if (currentlyPressedKeys['Enter'] || currentlyPressedKeys['NumpadEnter']) {
      if (playerAlive == true && isPaused == false)
      {
        if (remainingBullets > 0)
        {
            shoot();
        }
      }
    }
    if (e.code === 'KeyQ') {
      const now = Date.now();
      if (remainingBullets >= 5 && (now - lastQSkillTime > Q_SKILL_COOLDOWN))
      {
        MultiBullets();
        lastQSkillTime = now;
      }
    }
    if (e.key === "Escape") {
      if (gameStarted)
      {
        isPaused = !isPaused;
        if (isPaused && levelMusic && levelMusic.isPlaying) {
            levelMusic.pause();
        }
        if (!isPaused && levelMusic && !levelMusic.isPlaying) {
          levelMusic.play();
        }
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

  settingsBtn.onclick = () => {
    settingsPopup.style.display = 'block';
  };

  // Hide popup
  closeSettings.onclick = () => {
    settingsPopup.style.display = 'none';
  };

  window.addEventListener('mousedown', (e) => {
    if (
      settingsPopup.style.display === 'block' &&
      !settingsPopup.contains(e.target) &&
      e.target !== settingsBtn &&
      !settingsBtn.contains(e.target)
    ) {
      settingsPopup.style.display = 'none';
    }
  });
  muteCheckbox.addEventListener('change', function() {
    if (listener) {
      listener.setMasterVolume(this.checked ? 0 : 1);
    }
  });

function UIReset() {
  GameOverText.style.display = 'none';
  remainingBullets = MAX_BULLETS;
  updateAmmoUI();
  resetHealthUI();
  isGameStart = true;
}

function resetHealthUI() {
  const health = document.getElementById('health');
  health.innerHTML = '';
  for (let i = 0; i <= lives; i++) {
    const heart = document.createElement('span');
    heart.innerText = '❤️';
    heart.classList.add('heart');
    health.appendChild(heart);
  }
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
