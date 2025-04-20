import pyautogui
import time
try:
    blah=1
    while blah:
        x,y=pyautogui.position()
        if pyautogui.mouseInfo()=="left":
            print("Mouse position: ",x,",",y)
            break
        if pyautogui.mouseInfo()=="left":
            print("Mouse position2: ",x,",",y)
            break
        time.sleep(0.1)
        blah=0
except Exception as e:
    print("Tracking stopped")