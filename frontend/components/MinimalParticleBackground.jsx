"use client"

import { memo, useEffect, useRef } from "react"

const MinimalParticleBackground = memo(() => {
  const canvasRef = useRef(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    const particles = []
    const particleCount = 20
    
    class Particle {
      constructor() {
        this.reset()
        this.y = Math.random() * canvas.height
      }
      
      reset() {
        this.x = Math.random() * canvas.width
        this.y = -10
        this.speed = Math.random() * 0.2 + 0.1
        this.size = Math.random() * 1.5 + 0.5
        this.opacity = Math.random() * 0.3 + 0.1
      }
      
      update() {
        this.y += this.speed
        if (this.y > canvas.height + 10) this.reset()
      }
      
      draw() {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59, 130, 246, ${this.opacity})`
        ctx.fill()
      }
    }
    
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle())
    }
    
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(particle => {
        particle.update()
        particle.draw()
      })
      requestAnimationFrame(animate)
    }
    
    animate()
    
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none opacity-40"
      aria-hidden="true"
    />
  )
})

MinimalParticleBackground.displayName = 'MinimalParticleBackground'

export default MinimalParticleBackground