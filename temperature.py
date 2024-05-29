from gpiozero import MCP3008
from time import sleep
import math

V_in = 3.3
R_fixed = 108000
R_0 = 100000
T_0 = 298.15
B = 3950

thermistor = MCP3008(0)

while True:
	adc = thermistor.value
	voltage = adc * V_in
	resistance = R_fixed * ((V_in / voltage) - 1)
	temperature = 1 / (1/T_0 + (1/B) * math.log(resistance / R_0)) - 273.15
	print(' ')
	print('ADC Value: ' + str(adc))
	print('Voltage: ' + str(voltage))
	print('Resistance: ' + str(resistance))
	print('Temperature: ' + str(temperature))
	sleep(3)
