'use client'

import { useEffect, useRef } from 'react'

export default function DynamicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let time = 0

    // Stars
    let stars: Array<{
      x: number
      y: number
      size: number
      twinkleSpeed: number
      twinkleOffset: number
    }> = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initStars()
    }

    const initStars = () => {
      stars = []
      const count = Math.floor((canvas.width * canvas.height) / 8000)
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          twinkleSpeed: Math.random() * 0.02 + 0.01,
          twinkleOffset: Math.random() * Math.PI * 2
        })
      }
    }

    const drawNebula = (x: number, y: number, radius: number, color: string, intensity: number) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, color.replace(')', `, ${intensity})`).replace('rgb', 'rgba'))
      gradient.addColorStop(0.4, color.replace(')', `, ${intensity * 0.5})`).replace('rgb', 'rgba'))
      gradient.addColorStop(0.7, color.replace(')', `, ${intensity * 0.2})`).replace('rgb', 'rgba'))
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    }

    const animate = () => {
      time += 0.005

      // Clear with dark background
      ctx.fillStyle = '#09090b'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw flowing nebula clouds
      const nebulaIntensity = 0.08

      // Purple nebula - slowly moving
      drawNebula(
        canvas.width * 0.3 + Math.sin(time * 0.3) * 50,
        canvas.height * 0.4 + Math.cos(time * 0.2) * 30,
        canvas.width * 0.4,
        'rgb(88, 28, 135)',
        nebulaIntensity + Math.sin(time * 0.5) * 0.02
      )

      // Blue nebula
      drawNebula(
        canvas.width * 0.7 + Math.cos(time * 0.25) * 40,
        canvas.height * 0.6 + Math.sin(time * 0.35) * 40,
        canvas.width * 0.35,
        'rgb(30, 58, 138)',
        nebulaIntensity + Math.cos(time * 0.4) * 0.02
      )

      // Pink/magenta nebula
      drawNebula(
        canvas.width * 0.5 + Math.sin(time * 0.4) * 60,
        canvas.height * 0.3 + Math.cos(time * 0.3) * 50,
        canvas.width * 0.3,
        'rgb(112, 26, 117)',
        nebulaIntensity * 0.7 + Math.sin(time * 0.6) * 0.015
      )

      // Teal accent
      drawNebula(
        canvas.width * 0.2 + Math.cos(time * 0.2) * 30,
        canvas.height * 0.7 + Math.sin(time * 0.25) * 35,
        canvas.width * 0.25,
        'rgb(19, 78, 74)',
        nebulaIntensity * 0.5
      )

      // Draw twinkling stars
      stars.forEach(star => {
        const twinkle = Math.sin(time * star.twinkleSpeed * 100 + star.twinkleOffset) * 0.5 + 0.5
        const opacity = 0.3 + twinkle * 0.7

        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size * (0.8 + twinkle * 0.4), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.fill()

        // Add subtle glow to brighter stars
        if (star.size > 1) {
          const glowGradient = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.size * 4
          )
          glowGradient.addColorStop(0, `rgba(200, 200, 255, ${opacity * 0.3})`)
          glowGradient.addColorStop(1, 'rgba(200, 200, 255, 0)')
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.size * 4, 0, Math.PI * 2)
          ctx.fillStyle = glowGradient
          ctx.fill()
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    resize()
    animate()

    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-zinc-950" />

      {/* Animated canvas with nebula and stars */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />

      {/* Soft gradient overlays for depth */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-violet-950/10 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-zinc-950 to-transparent" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-radial-dark" />
    </div>
  )
}
