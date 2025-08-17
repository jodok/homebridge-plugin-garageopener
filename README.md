<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# Homebridge Garage Door Opener

</span>

> [!IMPORTANT]
> **Homebridge v2.0 Information**
>
> This plugin supports both Homebridge v1 and v2.

---

A Homebridge plugin that exposes your garage door as a HomeKit accessory. This plugin integrates with the [Raspberry Pi Relay Module](https://github.com/jodok/raspberry-pi-relay-module) to control your garage door through the Home app, Siri, and HomeKit automations.

## Features

- Control your garage door via HomeKit
- Automatic door state simulation based on your garage door's timing
- HTTP API integration with Raspberry Pi relay module
- HMAC-SHA256 authentication for secure communication
- Support for custom IP address, port, and GPIO pin configuration

## How It Works

This plugin sends an HTTP POST request to your Raspberry Pi relay module at `http://[IP_ADDRESS]:[PORT]/relay/trigger` to trigger the garage door. The request includes:

- **Authentication**: HMAC-SHA256 hash using your relay secret
- **Request Body**: `{"gpio_pin": 23}` (or your configured GPIO pin)
- **Headers**: `Content-Type: application/json` and `Authorization: Bearer <hash>`

The plugin then simulates the door's behavior:

1. **Opening**: 15 seconds to open
2. **Open**: Stays open for 30 seconds
3. **Closing**: 15 seconds to close

## Prerequisites

- [Raspberry Pi Relay Module](https://github.com/jodok/raspberry-pi-relay-module) installed and running
- The relay module's `RELAY_SECRET` from your `.env` file
- Homebridge v1.8.0+ or v2.0.0+

## Configuration

Add the following to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "GarageOpener",
      "name": "Garage Door",
      "ipAddress": "192.168.1.251",
      "port": 8080,
      "secret": "your_relay_secret_here",
      "gpioPin": 23
    }
  ]
}
```

### Configuration Options

- **name** (required): The name of your garage door as it will appear in HomeKit
- **ipAddress** (required): The IP address of your Raspberry Pi relay module (default: 192.168.1.251)
- **port** (required): The port number of your Raspberry Pi relay module (default: 8080)
- **secret** (required): The HMAC-SHA256 secret key from your relay module's `.env` file
- **gpioPin** (optional): The GPIO pin number connected to the relay module (default: 23)

### Getting Your Relay Secret

The `secret` field must match the `RELAY_SECRET` value in your Raspberry Pi relay module's `.env` file. To find this value:

1. SSH into your Raspberry Pi
2. Navigate to your relay module directory
3. Check the `.env` file:

   ```bash
   cat .env | grep RELAY_SECRET
   ```

If you need to regenerate the secret, you can use:

```bash
openssl rand -hex 32
```

## Installation

1. Install the plugin:

   ```bash
   sudo npm install -g homebridge-garage-opener
   ```

2. Add the platform configuration to your Homebridge config.json

3. Restart Homebridge

4. The garage door will appear in your Home app

## Testing Your Configuration

Before setting up Homebridge, you can test your Raspberry Pi relay module connection using the included test script:

```bash
# Test the connection and authentication
node test_auth.js your_secret_here 192.168.1.251 8080 23
```

This script will:

1. Test the health check endpoint (no authentication required)
2. Test the relay trigger endpoint with HMAC-SHA256 authentication
3. Show you the exact request being sent and response received

If both tests pass, your configuration is correct and ready for Homebridge.

## API Integration

This plugin integrates with the Raspberry Pi Relay Module API:

- **Endpoint**: `POST /relay/trigger`
- **Authentication**: HMAC-SHA256 with Bearer token
- **Request Body**: `{"gpio_pin": 23}` (or your configured pin)
- **Response**: JSON with status and timestamp

For more details, see the [Raspberry Pi Relay Module documentation](https://github.com/jodok/raspberry-pi-relay-module).

## Development

### Setup Development Environment

To develop this plugin you must have Node.js 18 or later installed, and a modern code editor such as [VS Code](https://code.visualstudio.com/).

### Install Development Dependencies

```shell
npm install
```

### Build Plugin

```shell
npm run build
```

### Link To Homebridge

```shell
npm link
```

### Watch For Changes and Build Automatically

```shell
npm run watch
```

## Requirements

- Homebridge v1.8.0+ or v2.0.0+
- Node.js 18+
- Raspberry Pi Relay Module running and accessible
- Valid relay secret for authentication

## Security

This plugin uses HMAC-SHA256 authentication to securely communicate with your Raspberry Pi relay module. Make sure to:

- Keep your relay secret secure and never share it
- Use HTTPS in production environments
- Restrict network access to your relay module
- Regularly rotate your relay secret

## License

Apache-2.0
