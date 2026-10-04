interface Navigator {
  readonly usb?: USB;
}

interface USB extends EventTarget {
  requestDevice(options?: USBDeviceRequestOptions): Promise<USBDevice>;
  getDevices(options?: USBDeviceRequestOptions): Promise<USBDevice[]>;
}

interface USBDeviceRequestOptions {
  filters?: USBDeviceFilter[];
}

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface USBDevice {
  readonly usbVersionMajor: number;
  readonly usbVersionMinor: number;
  readonly usbVersionSubminor: number;
  readonly deviceClass: number;
  readonly deviceSubclass: number;
  readonly deviceProtocol: number;
  readonly vendorId: number;
  readonly productId: number;
  readonly deviceVersionMajor: number;
  readonly deviceVersionMinor: number;
  readonly deviceVersionSubminor: number;
  readonly manufacturerName?: string;
  readonly productName?: string;
  readonly serialNumber?: string;
  readonly configuration?: USBConfiguration;
  readonly configurations: USBConfiguration[];
  readonly opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface(
    interfaceNumber: number,
    alternateSetting: number,
  ): Promise<void>;
  controlTransferIn(
    setup: USBControlTransferParameters,
    length: number,
  ): Promise<USBInTransferResult>;
  controlTransferOut(
    setup: USBControlTransferParameters,
    data?: BufferSource,
  ): Promise<USBOutTransferResult>;
  clearHalt(direction: USBDirection, endpointNumber: number): Promise<void>;
  transferIn(
    endpointNumber: number,
    length: number,
  ): Promise<USBInTransferResult>;
  transferOut(
    endpointNumber: number,
    data: BufferSource,
  ): Promise<USBOutTransferResult>;
  isochronousTransferIn(
    endpointNumber: number,
    packetLengths: number[],
  ): Promise<USBIsochronousInTransferResult>;
  isochronousTransferOut(
    endpointNumber: number,
    data: BufferSource,
    packetLengths: number[],
  ): Promise<USBIsochronousOutTransferResult>;
  reset(): Promise<void>;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface USBControlTransferParameters {
  requestType: "standard" | "class" | "vendor";
  recipient: "device" | "interface" | "endpoint" | "other";
  request: number;
  value: number;
  index: number;
}

type USBDirection = "in" | "out";

interface USBInTransferResult {
  data?: DataView;
  status: "ok" | "stall" | "babble";
}

interface USBOutTransferResult {
  bytesWritten: number;
  status: "ok" | "stall" | "babble";
}

interface USBIsochronousInTransferPacket {
  data?: DataView;
  status: "ok" | "stall" | "babble";
}

interface USBIsochronousInTransferResult {
  data?: DataView;
  packets: USBIsochronousInTransferPacket[];
}

interface USBIsochronousOutTransferPacket {
  bytesWritten: number;
  status: "ok" | "stall" | "babble";
}

interface USBIsochronousOutTransferResult {
  packets: USBIsochronousOutTransferPacket[];
}

interface USBConfiguration {
  readonly configurationValue: number;
  readonly configurationName?: string;
  readonly interfaces: USBInterface[];
}

interface USBInterface {
  readonly interfaceNumber: number;
  readonly alternate: USBAlternateInterface;
  readonly alternates: USBAlternateInterface[];
  readonly claimed: boolean;
}

interface USBAlternateInterface {
  readonly alternateSetting: number;
  readonly interfaceClass: number;
  readonly interfaceSubclass: number;
  readonly interfaceProtocol: number;
  readonly interfaceName?: string;
  readonly endpoints: USBEndpoint[];
}

interface USBEndpoint {
  readonly endpointNumber: number;
  readonly direction: USBDirection;
  readonly type: "bulk" | "interrupt" | "isochronous";
  readonly packetSize: number;
}
