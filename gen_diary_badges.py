import os

days = [1, 10, 30, 50, 100, 150, 200, 250, 300, 350, 365, 400, 450, 500]

def create_svg(day):
    if day < 30:
        color = "#3b82f6" # Blue
    elif day < 100:
        color = "#10b981" # Green
    elif day < 200:
        color = "#06b6d4" # Cyan
    elif day < 365:
        color = "#8b5cf6" # Purple
    elif day < 500:
        color = "#f59e0b" # Gold
    else:
        color = "#ef4444" # Red

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111827" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <!-- Base diamond -->
  <polygon points="50,5 95,50 50,95 5,50" fill="url(#bg)" stroke="{color}" stroke-width="3" filter="url(#glow)"/>
  <!-- Inner diamond -->
  <polygon points="50,15 85,50 50,85 15,50" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.3"/>
  <!-- Top and bottom glowing dots -->
  <circle cx="50" cy="15" r="3" fill="{color}" filter="url(#glow)"/>
  <circle cx="50" cy="85" r="3" fill="{color}" filter="url(#glow)"/>
  <!-- Text -->
  <text x="50" y="48" font-family="Impact, 'Arial Black', sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">{day}</text>
  <text x="50" y="70" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="bold" fill="{color}" text-anchor="middle" letter-spacing="1">DIARIES</text>
</svg>"""
    
    filename = f"assets/ui/badge_diary_{day}.svg"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(svg)

for d in days:
    create_svg(d)
    print(f"Generated badge_diary_{d}.svg")
