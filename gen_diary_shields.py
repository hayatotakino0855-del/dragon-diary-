import os

days = [1, 10, 30, 50, 100, 150, 200, 250, 300, 350, 365, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000]

def create_svg(val):
    # Color logic
    if val < 50:
        color = "#3b82f6" # Blue
    elif val < 200:
        color = "#10b981" # Green
    elif val < 500:
        color = "#06b6d4" # Cyan
    elif val < 800:
        color = "#8b5cf6" # Purple
    elif val < 1000:
        color = "#ec4899" # Pink/Magenta
    else:
        color = "#f59e0b" # Gold

    # Option B Shield Base
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="glow2"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <linearGradient id="gradB" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>"""
    
    if val == 1000:
        # Special 1000 Shield with Crown
        svg += f"""
  <!-- Special Crown -->
  <path d="M 25,18 L 35,32 L 50,10 L 65,32 L 75,18 L 68,38 L 32,38 Z" fill="{color}" opacity="0.9" filter="url(#glow2)"/>
  <circle cx="25" cy="18" r="3" fill="#ffffff" filter="url(#glow2)"/>
  <circle cx="50" cy="10" r="3" fill="#ffffff" filter="url(#glow2)"/>
  <circle cx="75" cy="18" r="3" fill="#ffffff" filter="url(#glow2)"/>
  <!-- Shield Body pushed down slightly -->
  <path d="M 50,35 L 90,45 L 90,70 C 90,90 50,98 50,98 C 50,98 10,90 10,70 L 10,45 Z" fill="url(#gradB)" stroke="{color}" stroke-width="3" filter="url(#glow2)"/>
  <path d="M 50,42 L 82,50 L 82,68 C 82,83 50,92 50,92 C 50,92 18,83 18,68 L 18,50 Z" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.2"/>
  <!-- Text -->
  <text x="50" y="66" font-family="Impact, 'Arial Black', sans-serif" font-size="24" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" filter="url(#glow2)">{val}</text>
  <text x="50" y="85" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="bold" fill="{color}" text-anchor="middle" letter-spacing="1">DIARIES</text>
</svg>"""
    else:
        # Normal Shield
        svg += f"""
  <path d="M 50,5 L 90,15 L 90,50 C 90,75 50,95 50,95 C 50,95 10,75 10,50 L 10,15 Z" fill="url(#gradB)" stroke="{color}" stroke-width="3" filter="url(#glow2)"/>
  <path d="M 50,12 L 82,20 L 82,48 C 82,68 50,85 50,85 C 50,85 18,68 18,48 L 18,20 Z" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.2"/>
  <text x="50" y="52" font-family="Impact, 'Arial Black', sans-serif" font-size="30" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" filter="url(#glow2)">{val}</text>
  <text x="50" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="bold" fill="{color}" text-anchor="middle" letter-spacing="1">DIARIES</text>
</svg>"""
        
    filename = f"assets/ui/badge_diary_{val}.svg"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(svg)

for d in days:
    create_svg(d)
    print(f"Generated badge_diary_{d}.svg")
