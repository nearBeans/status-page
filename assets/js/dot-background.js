const dotCanvas = document.querySelector('#dot-background');
const dotContext = dotCanvas.getContext('2d');
const dotMain = document.querySelector('main');
const dots = [];
let dotWidth = 0;
let dotHeight = 0;
let dotPixelRatio = 1;
let lastScrollTop = dotMain.scrollTop;
let scrollVelocity = 0;
let dotColor = '#383838';
let mouseX = -1000;
let mouseY = -1000;
let mouseVelocityX = 0;
let mouseVelocityY = 0;

function updateDotColor() {
    dotColor = '#383838';
}

function resizeDotCanvas() {
    dotPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    dotWidth = window.innerWidth;
    dotHeight = window.innerHeight;
    dotCanvas.width = dotWidth * dotPixelRatio;
    dotCanvas.height = dotHeight * dotPixelRatio;
    dotContext.setTransform(dotPixelRatio, 0, 0, dotPixelRatio, 0, 0);

    if (dots.length > 0) {
        return;
    }

    const spacing = 64;
    for (let x = spacing / 2; x < dotWidth + spacing; x += spacing) {
        for (let y = spacing / 2; y < dotHeight + spacing; y += spacing) {
            dots.push({
                x,
                y,
                radius: Math.random() * 1.2 + 0.8,
                drift: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.0007 + 0.0004,
                offsetX: 0,
                offsetY: 0,
                velocityX: 0,
                velocityY: 0
            });
        }
    }
}

function drawDots(time) {
    const currentScrollTop = dotMain.scrollTop;
    scrollVelocity += (currentScrollTop - lastScrollTop - scrollVelocity) * 0.08;
    lastScrollTop = currentScrollTop;

    dotContext.clearRect(0, 0, dotWidth, dotHeight);
    dotContext.fillStyle = dotColor;
    dots.forEach((dot) => {
        const drift = time * dot.speed + dot.drift;
        const baseX = dot.x + Math.sin(drift) * 12;
        const baseY = dot.y + Math.cos(drift * 0.8) * 12 - currentScrollTop * 0.08 - scrollVelocity * 0.5;
        const wrappedY = ((baseY % (dotHeight + 64)) + dotHeight + 64) % (dotHeight + 64) - 32;
        const distanceX = baseX + dot.offsetX - mouseX;
        const distanceY = wrappedY + dot.offsetY - mouseY;
        const distance = Math.hypot(distanceX, distanceY);
        const interactionRadius = 180;

        if (distance < interactionRadius) {
            const strength = (1 - distance / interactionRadius) * 0.7;
            const directionX = distance === 0 ? 0 : distanceX / distance;
            const directionY = distance === 0 ? 0 : distanceY / distance;
            dot.velocityX += directionX * strength + mouseVelocityX * 0.012 * strength - directionY * 0.18 * strength;
            dot.velocityY += directionY * strength + mouseVelocityY * 0.012 * strength + directionX * 0.18 * strength;
        }

        dot.velocityX += -dot.offsetX * 0.006;
        dot.velocityY += -dot.offsetY * 0.006;
        dot.velocityX *= 0.96;
        dot.velocityY *= 0.96;
        dot.offsetX += dot.velocityX;
        dot.offsetY += dot.velocityY;
        const x = baseX + dot.offsetX;
        const y = wrappedY + dot.offsetY;
        const opacity = 0.42 + (Math.sin(drift) + 1) * 0.18;

        dotContext.globalAlpha = Math.min(opacity, 0.8);
        dotContext.beginPath();
        dotContext.arc(x, y, dot.radius * 1.35, 0, Math.PI * 2);
        dotContext.fill();
    });
    mouseVelocityX *= 0.9;
    mouseVelocityY *= 0.9;
    dotContext.globalAlpha = 1;
    requestAnimationFrame(drawDots);
}

window.addEventListener('pointermove', (event) => {
    if (mouseX > -500) {
        mouseVelocityX = event.clientX - mouseX;
        mouseVelocityY = event.clientY - mouseY;
    }
    mouseX = event.clientX;
    mouseY = event.clientY;
});
window.addEventListener('pointerleave', () => {
    mouseX = -1000;
    mouseY = -1000;
});
window.addEventListener('resize', resizeDotCanvas);
document.addEventListener('themechange', updateDotColor);
updateDotColor();
resizeDotCanvas();
requestAnimationFrame(drawDots);