//var debug = localStorage.getItem('debug') || '';
var drawParticles = true; //debug.indexOf('particles') > -1;
var drawConstraints = true; //debug.indexOf('constraints') > -1;

function Verlet() {
  this.mouse = new Vec2(0, 0);
  this.mouseStart = new Vec2(0, 0);
  this.draggedEntity = null;

  // simulation params
  //this.gravity = new Vec2(0, 20);
  this.friction = 0.99;
  this.groundFriction = 0.8;

  // holds composite entities
  this.composites = [];
}

Verlet.prototype.putOnTop = function (boxFoundation, box, stiffness) {
  stiffness = stiffness || 0.67;

  boxFoundation.verlet = this;
  box.verlet = this;
  box.foundation = boxFoundation;


  // TODO: stiffness based on distance?

  var composite = new Composite();
  composite.constraints.push(new DistanceConstraint(boxFoundation.topLeft, box.topLeft, stiffness));
  composite.constraints.push(new DistanceConstraint(boxFoundation.topRight, box.topRight, stiffness));
  composite.constraints.push(new DistanceConstraint(boxFoundation.bottomLeft, box.bottomLeft, stiffness));
  composite.constraints.push(new DistanceConstraint(boxFoundation.bottomRight, box.bottomRight, stiffness));
  this.composites.push(composite);

  return composite;
};

Verlet.prototype.frame = function (step) {
  var i, j, c, p, particles, draggedEntity, particle, diff;

  for (c in this.composites) {
    for (i in this.composites[c].particles) {
      particles = this.composites[c].particles;

      // calculate velocity
      var velocity = particles[i].pos.sub(particles[i].lastPos).scale(this.friction);

      // ground friction
      if (/*particles[i].pos.y >= this.height - 1 && */velocity.length2() > 0.000001) {
        var m = velocity.length();
        velocity.x /= m;
        velocity.y /= m;
        velocity.mutableScale(m * this.groundFriction);
      }

      // save last good state
      particles[i].lastPos.mutableSet(particles[i].pos);

      // gravity
      //particles[i].pos.mutableAdd(this.gravity);

      // inertia
      particles[i].pos.mutableAdd(velocity);
    }
  }

  // handle dragging of entities
  // TODO: allow interpolation, i.e. 90% mouse, rest constraints
  if (this.draggedEntity) {
    diff = this.mouse.sub(this.mouseStart);
    draggedEntity = this.draggedEntity;
    var startPositions = draggedEntity.startPositions;
    particles = draggedEntity.particles;
    for (p in particles) {
      particle = particles[p];
      particle.pos.mutableSet(startPositions[p].add(diff));
    }
  }

  // relax
  var stepCoef = 1 / step;
  for (c in this.composites) {
    var constraints = this.composites[c].constraints;
    for (i = 0; i < step; ++i) {
      for (j in constraints) {
        constraints[j].relax(stepCoef);
      }
    }
  }

  /*
   // bounds checking
   for (c in this.composites) {
   particles = this.composites[c].particles;
   for (i in particles)
   this.bounds(particles[i]);
   }
   */
};

Verlet.prototype.draw = function () {
  var i, c;

  for (c in this.composites) {
    var composite = this.composites[c];
    if (composite.draw) {
      composite.draw();
    }

    var constraints = composite.constraints;
    for (i in constraints) {
      constraints[i].draw();
    }

    var particles = composite.particles;
    for (i in particles) {
      particles[i].draw();
    }
  }

  // highlight nearest / dragged entity
  /*var nearest = this.draggedEntity || this.nearestEntity();
   if (nearest) {
   this.ctx.beginPath();
   this.ctx.arc(nearest.pos.x, nearest.pos.y, 8, 0, 2*Math.PI);
   this.ctx.strokeStyle = this.highlightColor;
   this.ctx.stroke();
   }*/
};

var j = 0;

function Box(elem, options) {
  this.elem = elem;
  options = options || {};
  var stiffness = options.stiffness || 1;
  //this.hammer = new Hammer(elem, {});
  this.i = j + 1;
  j++;

  var $elem = $(elem);
  var offset = $elem.offset();
  var size = {width: $elem.outerWidth(), height: $elem.outerHeight()};

  var top = offset.top;
  var left = offset.left;
  var right = left + size.width;
  var bottom = top + size.height;

  //$('#ruler-horizontal-' + this.i).css({top: top});
  //$('#ruler-vertical-' + this.i).css({left: left});

  this.topLeft = new Particle(new Vec2(left, top));
  this.topRight = new Particle(new Vec2(right, top));
  this.bottomLeft = new Particle(new Vec2(left, bottom));
  this.bottomRight = new Particle(new Vec2(right, bottom));

  this.startTopLeft = new Particle(new Vec2(left, top));
  this.startTopRight = new Particle(new Vec2(right, top));
  this.startBottomLeft = new Particle(new Vec2(left, bottom));
  this.startBottomRight = new Particle(new Vec2(right, bottom));

  var topLeftTopRight = new DistanceConstraint(this.topLeft, this.topRight, stiffness);
  var topRightBottomRight = new DistanceConstraint(this.topRight, this.bottomRight, stiffness);
  var bottomLeftBottomRight = new DistanceConstraint(this.bottomLeft, this.bottomRight, stiffness);
  var topLeftBottomLeft = new DistanceConstraint(this.topLeft, this.bottomLeft, stiffness);
  var topLeftBottomRight = new DistanceConstraint(this.topLeft, this.bottomRight, stiffness);
  var topRightBottomLeft = new DistanceConstraint(this.topRight, this.bottomLeft, stiffness);

  this.particles = [this.topLeft, this.topRight, this.bottomLeft, this.bottomRight];
  this.constraints = [topLeftTopRight, topRightBottomRight, bottomLeftBottomRight, topLeftBottomLeft,
    //topLeftBottomRight, topRightBottomLeft
  ];

  //this.i = i + 1;
  //i++;
  //$('#ruler-horizontal-' + this.i).css({top: rect.top});
  //$('#ruler-vertical-' + this.i).css({left: rect.left});

  this.onTouchStart = Box.prototype.onTouchStart.bind(this);
  this.onTouchMove = Box.prototype.onTouchMove.bind(this);
  this.onTouchEnd = Box.prototype.onTouchEnd.bind(this);

  this.elem.addEventListener('touchstart', this.onTouchStart);

  this.onMouseDown = Box.prototype.onMouseDown.bind(this);
  this.onMouseMove = Box.prototype.onMouseMove.bind(this);
  this.onMouseUp = Box.prototype.onMouseUp.bind(this);

  this.elem.addEventListener('mousedown', this.onMouseDown);
}

Box.prototype.onMouseDown = function (e) {
  e.stopPropagation();
  this.onAnyStart.call(this, e);

  document.addEventListener('mousemove', this.onMouseMove);
  document.addEventListener('mouseup', this.onMouseUp);
};

Box.prototype.onTouchStart = function (e) {
  e.stopPropagation();
  var t = e.targetTouches[0];
  this.onAnyStart.call(this, t);

  document.addEventListener('touchmove', this.onTouchMove);
  document.addEventListener('touchend', this.onTouchEnd);
};


Box.prototype.onTouchMove= function (e) {
  e.stopPropagation();
  var t = e.targetTouches[0];
  this.onAnyMove.call(this, t);
};

Box.prototype.onMouseMove = function (e) {
  e.stopPropagation();
  this.onAnyMove.call(this, e);
};

Box.prototype.onTouchEnd = function (e) {
  e.stopPropagation();
  this.onAnyEnd.call(this);

  document.removeEventListener('touchmove', this.onTouchMove);
  document.removeEventListener('touchend', this.onTouchEnd);
};

Box.prototype.onMouseUp = function (e) {
  e.stopPropagation();
  this.onAnyEnd.call(this);

  document.removeEventListener('mousemove', this.onMouseMove);
  document.removeEventListener('mouseup', this.onMouseUp);
};

Box.prototype.onAnyStart = function (t) {
  this.verlet.draggedEntity = this;
  this.verlet.mouseStart.x = t.pageX;
  this.verlet.mouseStart.y = t.pageY;
  this.verlet.mouse.x = t.pageX;
  this.verlet.mouse.y = t.pageY;
  this.startPositions = this.particles.map(function (particle) {
    return new Vec2(0, 0).mutableSet(particle.pos)
  });
};

Box.prototype.onAnyMove = function (t) {
  this.verlet.mouse.x = t.pageX;
  this.verlet.mouse.y = t.pageY;
};

Box.prototype.onAnyEnd = function (t) {
  this.verlet.draggedEntity = null;
};

function getPos(x) {
  return x.pos;
}

Box.prototype.draw = function () {
  //console.log('Box#draw')
  matrix3d.applyTransform(this.elem,
    [this.startTopLeft, this.startBottomLeft, this.startTopRight, this.startBottomRight].map(getPos),
    [this.topLeft, this.bottomLeft, this.topRight, this.bottomRight].map(getPos)
  );
  /*

   var translate;
   if (this.parent) {
   translate = translatePx(
   Math.round(this.pos.x - this.left - (this.parent.pos.x - this.parent.left)),
   Math.round(this.pos.y - this.top - (this.parent.pos.y - this.parent.top))
   );
   } else {
   translate = translatePx(Math.round(this.pos.x - this.left), Math.round(this.pos.y - this.top));
   }

   $('#dot-' + this.i).css({left: this.pos.x, top: this.pos.y});
   //$('#dot-' + this.i + '-2').css({left: this.left, top: this.top});

   transform(this.elem, translate);
   */
};

function Particle(pos) {
  this.pos = (new Vec2()).mutableSet(pos);
  this.lastPos = (new Vec2()).mutableSet(pos);
  this.$elem = $('<div />').addClass('particle').appendTo(document.body);
}

function translatePx(x, y) {
  x = x || 0;
  y = y || 0;

  var term = [x, y].map(function (px) {
    return px + 'px'
  }).join(', ');

  return 'translate(' + term + ')'
}

function transform(element, transform) {
  element.style.webkitTransform = transform;
  element.style.mozTransform = transform;
  element.style.msTransform = transform;
  element.style.oTransform = transform;
  element.style.transform = transform;
}

function $transform(element, transform) {
  element.css({
    webkitTransform: transform,
    mozTransform: transform,
    msTransform: transform,
    oTransform: transform,
    transform: transform
  });
}

Particle.prototype.draw = function () {
  if (drawParticles) {
    var translate = translatePx(this.pos.x, this.pos.y);
    $transform(this.$elem, translate);
  }
};

function DistanceConstraint(a, b, stiffness, distance /*optional*/) {
  this.a = a;
  this.b = b;
  this.distance = distance != null ? distance : a.pos.sub(b.pos).length();
  this.stiffness = stiffness;
  if (drawConstraints) {
    this.$elem = $('<div />').addClass('distance-constraint').appendTo(document.body);
  }
}

DistanceConstraint.prototype.relax = function (stepCoef) {
  var normal = this.a.pos.sub(this.b.pos);
  var m = normal.length2();
  normal.mutableScale(((this.distance * this.distance - m) / m) * this.stiffness * stepCoef);
  this.a.pos.mutableAdd(normal);
  this.b.pos.mutableSub(normal);
};

DistanceConstraint.prototype.draw = function () {
  if (drawConstraints) {
    var delta = this.b.pos.sub(this.a.pos);
    var l = delta.length();
    this.$elem.css({
      'left': this.a.pos.x,
      'top': this.a.pos.y,
      'width': l
    });
    $transform(this.$elem, 'rotateZ(' + Math.atan2(delta.y, delta.x) + 'rad)');
  }
};

function AngleConstraint(a, b, c, stiffness) {
  this.a = a;
  this.b = b;
  this.c = c;
  this.angle = this.b.pos.angle2(this.a.pos, this.c.pos);
  this.stiffness = stiffness;
}

AngleConstraint.prototype.relax = function (stepCoef) {
  var angle = this.b.pos.angle2(this.a.pos, this.c.pos);
  var diff = angle - this.angle;

  if (diff <= -Math.PI)
    diff += 2 * Math.PI;
  else if (diff >= Math.PI)
    diff -= 2 * Math.PI;

  diff *= stepCoef * this.stiffness;

  this.a.pos = this.a.pos.rotate(this.b.pos, diff);
  this.c.pos = this.c.pos.rotate(this.b.pos, -diff);
  this.b.pos = this.b.pos.rotate(this.a.pos, diff);
  this.b.pos = this.b.pos.rotate(this.c.pos, -diff);
};

AngleConstraint.prototype.draw = function () {
};

function Composite() {
  this.particles = [];
  this.constraints = [];
}

