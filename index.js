// when animating on canvas, it is best to use requestAnimationFrame instead of setTimeout or setInterval
// not supported in all browsers though and sometimes needs a prefix, so we need a shim
window.requestAnimFrame = ( function() {
	return window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				function( callback ) {
					window.setTimeout( callback, 1000 / 60 );
				};
})();

// now we will setup our basic variables for the demo
var canvas = document.getElementById( 'canvas' ),
		ctx = canvas.getContext( '2d' ),
		// full screen dimensions
		cw = window.innerWidth,
		ch = window.innerHeight,
		// firework collection
		fireworks = [],
		// particle collection
		particles = [],
		// starting hue
		hue = 120,
		// when launching fireworks with a click, too many get launched at once without a limiter, one launch per 5 loop ticks
		limiterTotal = 50,
		limiterTick = 0,
		// this will time the auto launches of fireworks, one launch per 80 loop ticks
		timerTotal = 50,
		timerTick = 0,
		mousedown = false,
		// mouse x coordinate,
		mx,
		// mouse y coordinate
		my;
		
// set canvas dimensions
canvas.width = cw;
canvas.height = ch;

// now we are going to setup our function placeholders for the entire demo

// get a random number within a range
function random( min, max ) {
	return Math.random() * ( max - min ) + min;
}

// calculate the distance between two points
function calculateDistance( p1x, p1y, p2x, p2y ) {
	var xDistance = p1x - p2x,
			yDistance = p1y - p2y;
	return Math.sqrt( Math.pow( xDistance, 2 ) + Math.pow( yDistance, 2 ) );
}

// create firework
function Firework( sx, sy, tx, ty ) {
	// actual coordinates
	this.x = sx;
	this.y = sy;
	// starting coordinates
	this.sx = sx;
	this.sy = sy;
	// target coordinates
	this.tx = tx;
	this.ty = ty;
	// distance from starting point to target
	this.distanceToTarget = calculateDistance( sx, sy, tx, ty );
	this.distanceTraveled = 0;
	// track the past coordinates of each firework to create a trail effect, increase the coordinate count to create more prominent trails
	this.coordinates = [];
	this.coordinateCount = 3;
	// populate initial coordinate collection with the current coordinates
	while( this.coordinateCount-- ) {
		this.coordinates.push( [ this.x, this.y ] );
	}
	this.angle = Math.atan2( ty - sy, tx - sx );
	this.speed = 2;
	this.acceleration = 1.05;
	this.brightness = random( 50, 70 );
	// circle target indicator radius
	this.targetRadius = 1;
}

// update firework
Firework.prototype.update = function( index ) {
	// remove last item in coordinates array
	this.coordinates.pop();
	// add current coordinates to the start of the array
	this.coordinates.unshift( [ this.x, this.y ] );
	
	// cycle the circle target indicator radius
	if( this.targetRadius < 8 ) {
		this.targetRadius += 0.3;
	} else {
		this.targetRadius = 1;
	}
	
	// speed up the firework
	this.speed *= this.acceleration;
	
	// get the current velocities based on angle and speed
	var vx = Math.cos( this.angle ) * this.speed,
			vy = Math.sin( this.angle ) * this.speed;
	// how far will the firework have traveled with velocities applied?
	this.distanceTraveled = calculateDistance( this.sx, this.sy, this.x + vx, this.y + vy );
	
	// if the distance traveled, including velocities, is greater than the initial distance to the target, then the target has been reached
	if( this.distanceTraveled >= this.distanceToTarget ) {
		createParticles( this.tx, this.ty );
		// remove the firework, use the index passed into the update function to determine which to remove
		fireworks.splice( index, 1 );
	} else {
		// target not reached, keep traveling
		this.x += vx;
		this.y += vy;
	}
}

// draw firework
Firework.prototype.draw = function() {
	ctx.beginPath();
	// move to the last tracked coordinate in the set, then draw a line to the current x and y
	ctx.moveTo( this.coordinates[ this.coordinates.length - 1][ 0 ], this.coordinates[ this.coordinates.length - 1][ 1 ] );
	ctx.lineTo( this.x, this.y );
	ctx.strokeStyle = 'hsl(' + hue + ', 100%, ' + this.brightness + '%)';
	ctx.stroke();
	
	ctx.beginPath();
	// draw the target for this firework with a pulsing circle
	ctx.arc( this.tx, this.ty, this.targetRadius, 0, Math.PI * 2 );
	ctx.stroke();
}

// create particle
function Particle( x, y ) {
	this.x = x;
	this.y = y;
	// track the past coordinates of each particle to create a trail effect, increase the coordinate count to create more prominent trails
	this.coordinates = [];
	this.coordinateCount = 5;
	while( this.coordinateCount-- ) {
		this.coordinates.push( [ this.x, this.y ] );
	}
	// set a random angle in all possible directions, in radians
	this.angle = random( 0, Math.PI * 2 );
	this.speed = random( 1, 10 );
	// friction will slow the particle down
	this.friction = 0.95;
	// gravity will be applied and pull the particle down
	this.gravity = 1;
	// set the hue to a random number +-20 of the overall hue variable
	this.hue = random( hue - 20, hue + 20 );
	this.brightness = random( 50, 80 );
	this.alpha = 1;
	// set how fast the particle fades out
	this.decay = random( 0.015, 0.03 );
}

// update particle
Particle.prototype.update = function( index ) {
	// remove last item in coordinates array
	this.coordinates.pop();
	// add current coordinates to the start of the array
	this.coordinates.unshift( [ this.x, this.y ] );
	// slow down the particle
	this.speed *= this.friction;
	// apply velocity
	this.x += Math.cos( this.angle ) * this.speed;
	this.y += Math.sin( this.angle ) * this.speed + this.gravity;
	// fade out the particle
	this.alpha -= this.decay;
	
	// remove the particle once the alpha is low enough, based on the passed in index
	if( this.alpha <= this.decay ) {
		particles.splice( index, 1 );
	}
}

// draw particle
Particle.prototype.draw = function() {
	ctx. beginPath();
	// move to the last tracked coordinates in the set, then draw a line to the current x and y
	ctx.moveTo( this.coordinates[ this.coordinates.length - 1 ][ 0 ], this.coordinates[ this.coordinates.length - 1 ][ 1 ] );
	ctx.lineTo( this.x, this.y );
	ctx.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + this.brightness + '%, ' + this.alpha + ')';
	ctx.stroke();
}

// create particle group/explosion
function createParticles( x, y ) {
	// increase the particle count for a bigger explosion, beware of the canvas performance hit with the increased particles though
	var particleCount = 30;
	while( particleCount-- ) {
		particles.push( new Particle( x, y ) );
	}
}

// main demo loop
function loop() {
	// this function will run endlessly with requestAnimationFrame
	requestAnimFrame( loop );
	
	// increase the hue to get different colored fireworks over time
	hue += 0.5;
	
	// normally, clearRect() would be used to clear the canvas
	// we want to create a trailing effect though
	// setting the composite operation to destination-out will allow us to clear the canvas at a specific opacity, rather than wiping it entirely
	ctx.globalCompositeOperation = 'destination-out';
	// decrease the alpha property to create more prominent trails
	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.fillRect( 0, 0, cw, ch );
	// change the composite operation back to our main mode
	// lighter creates bright highlight points as the fireworks and particles overlap each other
	ctx.globalCompositeOperation = 'lighter';
	
	// loop over each firework, draw it, update it
	var i = fireworks.length;
	while( i-- ) {
		fireworks[ i ].draw();
		fireworks[ i ].update( i );
	}
	
	// loop over each particle, draw it, update it
	var i = particles.length;
	while( i-- ) {
		particles[ i ].draw();
		particles[ i ].update( i );
	}
	
	// launch fireworks automatically to random coordinates, when the mouse isn't down
	if( timerTick >= timerTotal ) {
		if( !mousedown ) {
			// start the firework at the bottom middle of the screen, then set the random target coordinates, the random y coordinates will be set within the range of the top half of the screen
			fireworks.push( new Firework( cw / 2, ch, random( 0, cw ), random( 0, ch / 2 ) ) );
			timerTick = 0;
		}
	} else {
		timerTick++;
	}
	
	// limit the rate at which fireworks get launched when mouse is down
	if( limiterTick >= limiterTotal ) {
		if( mousedown ) {
			// start the firework at the bottom middle of the screen, then set the current mouse coordinates as the target
			fireworks.push( new Firework( cw / 2, ch, mx, my ) );
			limiterTick = 0;
		}
	} else {
		limiterTick++;
	}
}

// mouse event bindings
// update the mouse coordinates on mousemove
canvas.addEventListener( 'mousemove', function( e ) {
	mx = e.pageX - canvas.offsetLeft;
	my = e.pageY - canvas.offsetTop;
});

// toggle mousedown state and prevent canvas from being selected
canvas.addEventListener( 'mousedown', function( e ) {
	e.preventDefault();
	mousedown = true;
});

canvas.addEventListener( 'mouseup', function( e ) {
	e.preventDefault();
	mousedown = false;
});

// once the window loads, we are ready for some fireworks!
window.onload = loop;


// function utils
function hasClass(elem, cls) {
    cls = cls || '';
    if (cls.replace(/\s/g, '').length == 0) return false; //当cls没有参数时，返回false
    return new RegExp(' ' + cls + ' ').test(' ' + elem.className + ' ');
  }
function addClass(ele, cls) {
    if (!hasClass(ele, cls)) {
        ele.className = ele.className == '' ? cls : ele.className + ' ' + cls;
    }
}
function removeClass(elem, cls) {
    if (hasClass(elem, cls)) {
      var newClass = ' ' + elem.className.replace(/[\t\r\n]/g, '') + ' ';
      while (newClass.indexOf(' ' + cls + ' ') >= 0) {
        newClass = newClass.replace(' ' + cls + ' ', ' ');
      }
      elem.className = newClass.replace(/^\s+|\s+$/g, '');
    }
}
function $$(id) {
    return document.getElementById(id);
}
function $$$1(selector) {
    return document.querySelector(selector);
}
// function utils

// 打开信封，展示界面
function openLetter(){
    addClass(document.body, 'content');
    addClass($$('letter'), 'hide');
    removeClass($$('content'), 'hide');
    setTimeout(function(){
        addClass($$$1('#content .heart'), 'content');
    }, 0);
    setTimeout(function(){
        removeClass($$('left_top'), 'hide');
        removeClass($$('content2'), 'hide');
        $("#messageState").attr('checked', true);
        changeMessage();
    }, 2000);
}
let imageInter = null;
const $img = $('#images');
/* 内容 */
function changeMessage() {
    $(".message").removeClass("openNor").removeClass("closeNor");
	if ($("#messageState").is(":checked")) {
		if(imageInter){
			clearInterval(imageInter);
		}
		$img.hide();
		$(".message").removeClass("closed").removeClass("no-anim").addClass("openNor");
		$(".heart2").removeClass("closeHer").removeClass("openedHer").addClass("openHer");
		$(".container").stop().animate({"backgroundColor": "#f48fb1"}, 2000);
        console.log("Abrindo");
		startFromBegin();
	} else {
		$(".message").removeClass("no-anim").addClass("closeNor");
		$(".heart2").removeClass("openHer").removeClass("openedHer").addClass("closeHer");
		$(".container").stop().animate({"backgroundColor": "#fce4ec"}, 2000);
		console.log("fechando");
        // document.querySelector("#content2 .message").textContent = '';
	}
}
$("#messageState").on("change", changeMessage);

$(".message").on('webkitAnimationEnd oanimationend msAnimationEnd animationend', function(e) {
	console.log("Animation End");
	if ($(".message").hasClass("closeNor"))
		$(".message").addClass("closed");
	$(".message").removeClass("openNor").removeClass("closeNor").addClass("no-anim");
	if(!$("#messageState").is(":checked")){
		$img.show();
		imageInter = setInterval(showImages, 3000);
	}
});

$(".heart2").on('webkitAnimationEnd oanimationend msAnimationEnd animationend', function(e) {
	console.log("Animation End");
	if (!$(".heart2").hasClass("closeHer"))
		$(".heart2").addClass("openedHer").addClass("beating");
	else
		$(".heart2").addClass("no-anim").removeClass("beating");
	$(".heart2").removeClass("openHer").removeClass("closeHer");
});
/* 内容 */

/** 打字效果*/
// Potential text box for inputing target text

// Initiating how many letters are there
let i = 0; 
// var clickSound = new Audio("http://www.freesfx.co.uk/rx2/mp3s/6/18660_1464810669.mp3");
const $messagDiv = $("#content2 .message");
let $lastSpan = null;
let endTime = null;
function dashOut (arr){
    if (i<arr.length) {
        if(arr[i] === '\n'){
            $messagDiv.append(document.createElement('br'));
        }else if(arr[i] === '^'){
            const lastSpan = document.createElement('div');
            $lastSpan = $(lastSpan);
            $messagDiv.append(lastSpan);
        }else if(arr[i] === '$'){
            $messagDiv.addClass('end'); 
            addClass(document.body, 'end'); 
        }else{
            $content = $lastSpan || $messagDiv;
            const h = $content.html();
            $content.html(h +  arr[i]);
        }
        i++;
        const time = interval(arr[i]);
        setTimeout(function(){dashOut(arr)}, time);
        toBotton(0);
    }
}

function interval(letter) { // 停顿
    if (letter == "。" || letter == "." || letter == "," || letter == "，") {
        return Math.floor(Math.random() * 500 + 1);
    } else {
        return Math.floor(Math.random() * 300 + 1);
    }
}
let first = false;
const text = `To 最爱的倩倩：
    
    一定是特别的缘分，让我遇见你，与你相识相知。
    就像小王子只是千万个小男孩中的一个，小狐狸也只是千万只狐狸中的一只，
    然而，彼此需要的两者，对彼此而言，便是宇宙唯一的了。
    你对我而言，也是如此，如此的唯一，如此的特别。
    如果离别是为了更好地相聚，我不愿再重蹈覆辙，这一次，我绝不允许自己犯下愚蠢的错，因为你是我最想要珍重的人，最特别的那个人。
    
	一件普通的事，和你一起做，就不再普通，
	一件没意义的事，和你一起做，就是有意义的。
    一个不解风情的我，和你在一起，也会变得柔情，
    一个不爱言语的我，和你在一起，也想要说个没完。
    有你的世界，才是我最想要的世界。
    
    两千多里的距离很远，而你却又很近，因为，
    想你的时候，宫阙之上云霞是你，微风是你。
    想你的时候，琵琶声处余音是你，静默是你。
    我想走近你，拥抱你。人生本无归途，有你的地方便是归途。
    我想和你一起走未走过的路，一起看未看过的风景，
	我想和你一起去未曾到过的远方，一起回那熟悉的小家。
	有你的路，就是我要去的路。
    
    如果我看起来多变，那是因为，只有你才能触动我所有的情绪啊。
    那个见到时开心，想起时安心的人啊。
    愿一世钟情于此一人，了胜世间风情。
    
    ^From 蒋顺$
	`;
	// 微风起时，朦朦胧胧，虽沐其中，却难捉摸。
    // 但至风歇，渐行渐止，心向往之，缘合缘起。
    // 风起风歇，吾心亦此，前路漫漫，携手坦之。
function startFromBegin (){
    if(first){
        return;
    }
    first = true;
    i = 0;
    $messagDiv[0].textContent = '';
    dashOut(text.split(''));
}
/** 打字效果*/
function toBotton(time){
    $messagDiv.animate({
        scrollTop: $messagDiv.get(0).scrollHeight
    }, time);
}
$$$1('#envelope .sides').addEventListener('click', openLetter);
$$$1('#letter .heart').addEventListener('click', openLetter);
$('#music').on('load', function(e){
	try {
		e.target.contentWindow.document.getElementById('play').click();
	} catch (error) {
		removeClass(e.target, 'hide');
	}
	console.log('ready.')
})

$('#images img').on('click', showImages);
// 轮播相册
function showImages(){
	const cls = 'show';
	const current = $('#images img.show');
	let next = current.next();
	if(!next.length){
		next = $('#images img:first');
	}
	current.removeClass(cls);
	next.addClass(cls);
	// console.log(1111)
}