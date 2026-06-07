import re

with open('css/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

# We want to replace the block of evolution-charge-egg-anim
new_anim = """@keyframes evolution-charge-egg-anim {
  0%   { filter: brightness(1); transform: rotate(0deg) translateX(0px); opacity: 1; }
  
  /* Twitch 1 */
  9%   { filter: brightness(1.1); transform: rotate(0deg) translateX(0px); }
  10%  { filter: brightness(1.1); transform: rotate(8deg) translateX(2px); }
  11%  { filter: brightness(1.1); transform: rotate(-5deg) translateX(-2px); }
  13%  { filter: brightness(1.1); transform: rotate(0deg) translateX(0px); }

  /* Twitch 2 */
  19%  { filter: brightness(1.2); transform: rotate(0deg) translateX(0px); }
  20%  { filter: brightness(1.2); transform: rotate(-10deg) translateX(-3px); }
  21%  { filter: brightness(1.2); transform: rotate(6deg) translateX(3px); }
  23%  { filter: brightness(1.2); transform: rotate(0deg) translateX(0px); }

  /* Twitch 3 */
  29%  { filter: brightness(1.3); transform: rotate(0deg) translateX(0px); }
  30%  { filter: brightness(1.3); transform: rotate(12deg) translateX(4px); }
  31%  { filter: brightness(1.3); transform: rotate(-8deg) translateX(-4px); }
  33%  { filter: brightness(1.3); transform: rotate(0deg) translateX(0px); }

  /* Double Twitch */
  39%  { filter: brightness(1.4) drop-shadow(0 0 10px white); transform: rotate(0deg) translateX(0px); }
  40%  { filter: brightness(1.4) drop-shadow(0 0 10px white); transform: rotate(-12deg) translateX(-5px); }
  41%  { filter: brightness(1.4) drop-shadow(0 0 10px white); transform: rotate(10deg) translateX(5px); }
  42%  { filter: brightness(1.4) drop-shadow(0 0 10px white); transform: rotate(-8deg) translateX(-5px); }
  44%  { filter: brightness(1.4) drop-shadow(0 0 10px white); transform: rotate(0deg) translateX(0px); }

  /* Double Twitch Stronger */
  49%  { filter: brightness(1.5) drop-shadow(0 0 20px cyan); transform: rotate(0deg) translateX(0px); }
  50%  { filter: brightness(1.5) drop-shadow(0 0 20px cyan); transform: rotate(15deg) translateX(6px); }
  51%  { filter: brightness(1.5) drop-shadow(0 0 20px cyan); transform: rotate(-12deg) translateX(-6px); }
  52%  { filter: brightness(1.5) drop-shadow(0 0 20px cyan); transform: rotate(10deg) translateX(6px); }
  54%  { filter: brightness(1.5) drop-shadow(0 0 20px cyan); transform: rotate(0deg) translateX(0px); }

  /* Triple Twitch */
  59%  { filter: brightness(1.8) drop-shadow(0 0 30px white); transform: rotate(0deg) translateX(0px); }
  60%  { filter: brightness(1.8) drop-shadow(0 0 30px white); transform: rotate(-15deg) translateX(-8px); }
  62%  { filter: brightness(1.8) drop-shadow(0 0 30px white); transform: rotate(15deg) translateX(8px); }
  64%  { filter: brightness(1.8) drop-shadow(0 0 30px white); transform: rotate(-10deg) translateX(-8px); }
  66%  { filter: brightness(1.8) drop-shadow(0 0 30px white); transform: rotate(0deg) translateX(0px); }

  /* Continuous Shake Starts */
  69%  { filter: brightness(2) drop-shadow(0 0 50px cyan); transform: rotate(0deg) translateX(0px); }
  70%  { filter: brightness(2) drop-shadow(0 0 50px cyan); transform: rotate(12deg) translateX(10px); }
  72%  { filter: brightness(2) drop-shadow(0 0 50px cyan); transform: rotate(-14deg) translateX(-10px); }
  74%  { filter: brightness(2) drop-shadow(0 0 50px cyan); transform: rotate(14deg) translateX(10px); }
  76%  { filter: brightness(2) drop-shadow(0 0 50px cyan); transform: rotate(-16deg) translateX(-10px); }
  78%  { filter: brightness(2) drop-shadow(0 0 50px cyan); transform: rotate(0deg) translateX(0px); }

  /* Faster Shake */
  80%  { filter: brightness(3) drop-shadow(0 0 80px white); transform: rotate(16deg) translateX(12px); }
  82%  { filter: brightness(3) drop-shadow(0 0 80px white); transform: rotate(-16deg) translateX(-12px); }
  84%  { filter: brightness(3) drop-shadow(0 0 80px white); transform: rotate(18deg) translateX(12px); }
  86%  { filter: brightness(3) drop-shadow(0 0 80px white); transform: rotate(-18deg) translateX(-12px); }
  88%  { filter: brightness(3) drop-shadow(0 0 80px white); transform: rotate(20deg) translateX(12px); }
  
  /* Violent Shake */
  90%  { filter: brightness(5) drop-shadow(0 0 120px cyan); transform: rotate(-22deg) translateX(-14px); }
  92%  { filter: brightness(6) drop-shadow(0 0 150px white); transform: rotate(22deg) translateX(14px); }
  94%  { filter: brightness(7) drop-shadow(0 0 180px cyan); transform: rotate(-24deg) translateX(-14px); }
  96%  { filter: brightness(9) drop-shadow(0 0 200px white); transform: rotate(24deg) translateX(14px); }
  98%  { filter: brightness(12) drop-shadow(0 0 250px cyan); transform: rotate(-25deg) translateX(-15px); }
  100% { filter: brightness(18) drop-shadow(0 0 350px white); transform: rotate(0deg) translateX(0px); opacity: 1; }
}"""

# Use regex to replace the block
pattern = re.compile(r'@keyframes evolution-charge-egg-anim\s*\{.*?\n\}\n', re.DOTALL)
new_css = pattern.sub(new_anim + '\n\n', css)

with open('css/index.css', 'w', encoding='utf-8') as f:
    f.write(new_css)
print("Updated css/index.css")
