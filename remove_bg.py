import os
from rembg import remove

dragon_dir = r"c:\Users\User\OneDrive\デスクトップ\日記\assets\dragons"

for filename in os.listdir(dragon_dir):
    if filename.endswith(".png"):
        input_path = os.path.join(dragon_dir, filename)
        
        with open(input_path, 'rb') as i:
            input_data = i.read()
            
        output_data = remove(input_data)
        
        with open(input_path, 'wb') as o:
            o.write(output_data)
            
        print(f"Processed: {filename}")
