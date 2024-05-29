const express = require("express")
const Gpio = require('onoff').Gpio;
const {spawn} = require('child_process')
const mcpadc = require('mcp-spi-adc')
const fs = require('fs')
const cron = require('node-cron')
const path = require('path')

var tempSensor = mcpadc.open(0, {speedHz: 1000}, err => {
	if (err) throw err
})

var temperature = 0
const V_in = 3.3
const R_fixed = 108000
const R_0 = 100000
const T_0 = 298.15
Beta = 3950
const A = 0.001599
const B = 0.00006978
const C = 0.0000006352

const app = express()

app.use(express.urlencoded({extended: false}))

app.set('view engine', 'ejs')

const lastWaterChangeFilePath = './lastWaterChange.txt'
const lastFishFeedingFilePath = './lastFishFeeding.txt'

// cat /sys/kernel/debug/gpio to get these gpio numbers
const ledGpio = new Gpio(529, 'out')
const buttonGpio = new Gpio(526, 'in', 'rising', {debounceTimeout: 100})

buttonGpio.watch((err, value) => {
	if(err) {
		console.error("Error watching button GPIO: ", err)
		return
	}
	feedFish('../servo.py', [])
})

let isFeedingFish = false
let lastWaterChange = null
let lastFishFeeding = null

function readTemperature() {
	tempSensor.read((err, reading) => {
		voltage = (reading.value) * V_in
		resistance = R_fixed * ((V_in / voltage) - 1)
		temperature = 1 / (A + B * Math.log(resistance) + C * (Math.log(resistance)) ** 3) - 273.15
		/*
		console.log(
			"ADC Value: " + reading.value + "\n" +
			"Voltage: " + voltage + "\n" + 
			"Resistance: " + resistance + "\n" +
			"Temperature: " + temperature + "\n" )
		*/
	})
	return temperature
}

function logTemperature() {
	const timestamp = new Date().toISOString();
	const temperature = readTemperature()
	const csvLine = `${timestamp},${temperature}\n`

	fs.appendFile('temperature_log.csv', csvLine, (err) => {
		if(err) {
			console.error('Error writing to CSV file', err)
		} else {
			console.log('Logged temperature: ', csvLine.trim()) 
		}
	})
}

function feedFish(scriptPath, args = []) {
	return new Promise((resolve, reject) => {

		if(isFeedingFish) {
			return reject('Already feeding fish')
		}

		isFeedingFish = true
		const command = 'python3';
        	const args = ['../servo.py'];
        	const env = { ...process.env, GPIOZERO_PIN_FACTORY: 'pigpio' };

        	// Spawn a new process
        	const pythonProcess = spawn(command, args, { env });

		let scriptOutput = ''
		pythonProcess.stdout.on('data', (data) => {
			scriptOutput += data.toString()
		})
		pythonProcess.stderr.on('data', (data) => {
			console.error(`Error: ${data}`)
		})
		pythonProcess.on('close', (code) => {
			if(code !== 0) {
				reject(`Feed fish script exited with code ${code}`)
			} else {
				lastFishFeeding = new Date().toISOString()
				try {
					fs.writeFileSync(lastFishFeedingFilePath, lastFishFeeding, 'utf8')
				} catch(err) {
					console.error('Error writing last fish feeding: ', err)
				}
				resolve(scriptOutput)
			}
			isFeedingFish = false;

		})
	})
}

app.get("/", (req, res) => {
	res.render("login.ejs")
})

app.post("/login", (req, res) => {
	if(req.body.password === "1337") {
		res.render("index.ejs")
	} else {
		console.log("Wrong password")
		res.render("login.ejs")
	}
})


app.post("/toggleLED", (req, res) => {
	ledGpio.writeSync(ledGpio.readSync() ^ 1)
	res.send('LED toggled')
})

app.post("/feedFish", (req, res) => {
	feedFish('../servo.py', [])
		.then((output) => {
			console.log(`Script output: ${output}`)
		})
		.catch((error) => {
			console.error(`Error: ${error}`)
		})
	res.json({data: lastFishFeeding})
})

app.post("/readTemp", (req, res) => {
	tempSensor.read((err, reading) => {
		voltage = (reading.value) * V_in
		resistance = R_fixed * ((V_in / voltage) - 1)
		temperature = 1 / (A + B * Math.log(resistance) + C * (Math.log(resistance)) ** 3) - 273.15
		/*
		console.log(
			"ADC Value: " + reading.value + "\n" +
			"Voltage: " + voltage + "\n" + 
			"Resistance: " + resistance + "\n" +
			"Temperature: " + temperature + "\n" )
		*/
	})
	
	res.json({temperature})
})

app.get('/temperature_log.csv', (req,res) => {
	res.sendFile(path.join(__dirname, 'temperature_log.csv'))
})

app.post('/set_lastwaterchange', (req,res) => {
	lastWaterChange = new Date().toISOString()
	try {
		fs.writeFileSync(lastWaterChangeFilePath, lastWaterChange, 'utf8')
	} catch(err) {
		console.error('Error writing last water change: ', err)
	}
	res.json({data: lastWaterChange})
})

app.get('/get_lastwaterchange', (req,res) => {
	try {
		if(fs.existsSync(lastWaterChangeFilePath)) {
			lastWaterChange = fs.readFileSync(lastWaterChangeFilePath, 'utf8')
		}
	} catch(err) {
		console.error('Error reading last water change:', err);
	}
	res.json({data: lastWaterChange})
})

app.get('/get_lastfishfeeding', (req, res) => {
	try {
		if(fs.existsSync(lastFishFeedingFilePath)) {
			lastFishFeeding = fs.readFileSync(lastFishFeedingFilePath, 'utf8')
		}
	} catch(err) {
		console.error('Error reading last fish feeding:', err);
	}
	res.json({data: lastFishFeeding})
})




process.on('SIGINT', function() {
	ledGpio.writeSync(0)
	ledGpio.unexport()
	buttonGpio.unexport()
	tempSensor.close(err => {
		if (err) throw err
	})
	console.log("Exiting")
	process.exit()
})


cron.schedule('*/10 * * * *', logTemperature)
console.log('Temperature logging started')


app.listen(3000, () => {
	console.log("server listening on port 3000")
	console.log(path.join(__dirname, 'temperature_log.csv'))
})
