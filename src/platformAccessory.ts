import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import * as http from 'node:http';
import * as crypto from 'node:crypto';

import type { GarageOpenerPlatform } from './platform.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class GarageDoorAccessory {
  private service: Service;

  /**
   * Garage door states
   */
  private doorStates = {
    CurrentDoorState: 1, // 0=Open, 1=Closed, 2=Opening, 3=Closing, 4=Stopped
    TargetDoorState: 1,  // 0=Open, 1=Closed
    ObstructionDetected: false,
  };

  constructor(
    // eslint-disable-next-line no-unused-vars
    private readonly platform: GarageOpenerPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Custom Garage Opener')
      .setCharacteristic(this.platform.Characteristic.Model, 'HTTP Garage Door')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'GD-001');

    // get the GarageDoorOpener service if it exists, otherwise create a new GarageDoorOpener service
    this.service = this.accessory.getService(this.platform.Service.GarageDoorOpener) ||
      this.accessory.addService(this.platform.Service.GarageDoorOpener);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // register handlers for the required characteristics
    // see https://developers.homebridge.io/#/service/GarageDoorOpener

    // Current Door State
    this.service.getCharacteristic(this.platform.Characteristic.CurrentDoorState)
      .onGet(this.getCurrentDoorState.bind(this));

    // Target Door State
    this.service.getCharacteristic(this.platform.Characteristic.TargetDoorState)
      .onSet(this.setTargetDoorState.bind(this))
      .onGet(this.getTargetDoorState.bind(this));

    // Obstruction Detected
    this.service.getCharacteristic(this.platform.Characteristic.ObstructionDetected)
      .onGet(this.getObstructionDetected.bind(this));
  }

  /**
   * Handle "SET" requests from HomeKit for Target Door State
   * These are sent when the user changes the state of the garage door
   */
  async setTargetDoorState(value: CharacteristicValue) {
    const targetState = value as number;
    const currentState = this.doorStates.CurrentDoorState;

    this.platform.log.debug('Set Target Door State ->', targetState);

    // Only trigger if the door is not already in the target state
    if (targetState === 0 && currentState != 0) { // Open
      await this.triggerGarageDoor();
      this.doorStates.CurrentDoorState = 2; // Opening
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentDoorState, 2);

      // Simulate door opening sequence
      setTimeout(() => {
        this.doorStates.CurrentDoorState = 0; // Open
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentDoorState, 0);
        setTimeout(() => {
          this.doorStates.CurrentDoorState = 3; // Closing
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentDoorState, 3);
          this.service.updateCharacteristic(this.platform.Characteristic.TargetDoorState, 1);
          setTimeout(() => {
            this.doorStates.CurrentDoorState = 1; // Closed
            this.service.updateCharacteristic(this.platform.Characteristic.CurrentDoorState, 1);
          }, 15000); // 15 seconds to close
        }, 30000); // 30 seconds to open
      }, 15000); // 15 seconds to open
    }
  }

  /**
   * Handle "GET" requests from HomeKit for Target Door State
   */
  async getTargetDoorState(): Promise<CharacteristicValue> {
    const targetState = this.doorStates.TargetDoorState;
    this.platform.log.debug('Get Target Door State ->', targetState);
    return targetState;
  }

  /**
   * Handle "GET" requests from HomeKit for Current Door State
   */
  async getCurrentDoorState(): Promise<CharacteristicValue> {
    const currentState = this.doorStates.CurrentDoorState;
    this.platform.log.debug('Get Current Door State ->', currentState);
    return currentState;
  }

  /**
   * Handle "GET" requests from HomeKit for Obstruction Detected
   */
  async getObstructionDetected(): Promise<CharacteristicValue> {
    const obstructionDetected = this.doorStates.ObstructionDetected;
    this.platform.log.debug('Get Obstruction Detected ->', obstructionDetected);
    return obstructionDetected;
  }

  /**
   * Generate HMAC-SHA256 hash for authentication
   */
  private generateAuthHash(body: string): string {
    const device = this.accessory.context.device;
    const secret = device.secret;

    if (!secret) {
      throw new Error('Relay secret not configured');
    }

    return crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
  }

  /**
   * Trigger the garage door via HTTP POST request to the Raspberry Pi relay module
   */
  private async triggerGarageDoor(): Promise<void> {
    const device = this.accessory.context.device;
    const url = `http://${device.ipAddress}:${device.port}/relay/trigger`;

    // Request body as specified in the API documentation
    const requestBody = JSON.stringify({
      gpio_pin: device.gpioPin || 23,
    });

    // Generate HMAC-SHA256 authentication hash
    const authHash = this.generateAuthHash(requestBody);

    this.platform.log.info(`Triggering garage door at ${url} with GPIO pin ${device.gpioPin || 23}`);

    return new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authHash}`,
          'Content-Length': Buffer.byteLength(requestBody),
        },
        timeout: 5000,
      }, (res: http.IncomingMessage) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          this.platform.log.debug(`Garage door trigger response: ${res.statusCode} - ${data}`);

          if (res.statusCode === 200) {
            this.platform.log.info('Garage door triggered successfully');
            resolve();
          } else {
            this.platform.log.error(`Garage door trigger failed with status ${res.statusCode}: ${data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error: Error) => {
        this.platform.log.error('Error triggering garage door:', error.message);
        reject(error);
      });

      req.on('timeout', () => {
        this.platform.log.error('Timeout triggering garage door');
        req.destroy();
        reject(new Error('Timeout'));
      });

      req.write(requestBody);
      req.end();
    });
  }
}
