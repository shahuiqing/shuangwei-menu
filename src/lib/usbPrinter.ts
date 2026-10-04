import { buildOrderTicket, buildTestTicket } from "./escpos";
import type { ReceiptSettings } from "../types/menu";

export interface UsbPrinterState {
  connected: boolean;
  name: string;
  supported: boolean;
}

type Listener = (s: UsbPrinterState) => void;

interface PrinterEndpoint {
  interfaceNumber: number;
  endpointNumber: number;
  packetSize: number;
}

class UsbPrinterManager {
  private device: USBDevice | null = null;
  private endpoint: PrinterEndpoint | null = null;
  private listeners = new Set<Listener>();

  private _state: UsbPrinterState = {
    connected: false,
    name: "",
    supported: typeof navigator !== "undefined" && "usb" in navigator,
  };

  private setState(patch: Partial<UsbPrinterState>) {
    this._state = { ...this._state, ...patch };
    this.listeners.forEach((cb) => cb(this._state));
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    cb(this._state);
    return () => this.listeners.delete(cb);
  }

  get connected(): boolean {
    return this.device !== null;
  }

  get state(): UsbPrinterState {
    return this._state;
  }

  private resolveEndpoint(device: USBDevice): PrinterEndpoint | null {
    if (!device.configuration) return null;
    for (const iface of device.configuration.interfaces) {
      const alt = iface.alternates[0];
      if (!alt) continue;
      const out = alt.endpoints.find(
        (ep) =>
          ep.direction === "out" &&
          (ep.type === "bulk" || ep.type === "interrupt"),
      );
      if (out) {
        return {
          interfaceNumber: iface.interfaceNumber,
          endpointNumber: out.endpointNumber,
          packetSize: out.packetSize,
        };
      }
    }
    return null;
  }

  async autoReconnect(): Promise<boolean> {
    if (!this.state.supported || !navigator.usb || this.device) return false;
    try {
      const devices = await navigator.usb.getDevices();
      for (const d of devices) {
        try {
          await this.connectDevice(d);
          return true;
        } catch {
          // 尝试下一个已授权设备
        }
      }
    } catch (e) {
      console.warn("[usbPrinter] autoReconnect 失败", e);
    }
    return false;
  }

  async requestAndConnect(): Promise<void> {
    if (!this.state.supported || !navigator.usb) {
      throw new Error("当前浏览器不支持 WebUSB，请使用 Chrome 或 Edge");
    }
    const device = await navigator.usb.requestDevice({
      filters: [
        { classCode: 0x07 },
        { classCode: 0xff, subclassCode: 0xff, protocolCode: 0xff },
      ],
    });
    await this.connectDevice(device);
  }

  async connectDevice(device: USBDevice): Promise<void> {
    try {
      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      const endpoint = this.resolveEndpoint(device);
      if (!endpoint) {
        await device.close().catch(() => undefined);
        throw new Error("未找到打印机的输出端点，请确认已连接正确的热敏打印机");
      }
      try {
        await device.claimInterface(endpoint.interfaceNumber);
      } catch {
        // 已被占用时忽略，仍尝试直接发送
      }
      this.device = device;
      this.endpoint = endpoint;
      this.setState({
        connected: true,
        name: device.productName || "USB 热敏打印机",
      });
      device.addEventListener("disconnect", () => this.handleDisconnect());
    } catch (e) {
      try {
        await device.close().catch(() => undefined);
      } catch {
        /* ignore */
      }
      throw e;
    }
  }

  private handleDisconnect() {
    this.device = null;
    this.endpoint = null;
    this.setState({ connected: false, name: "" });
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    this.device = null;
    this.endpoint = null;
    this.setState({ connected: false, name: "" });
    if (device) {
      try {
        await device.close();
      } catch {
        /* ignore */
      }
    }
  }

  async print(bytes: Uint8Array): Promise<void> {
    if (!this.device || !this.endpoint) {
      throw new Error("未连接 USB 打印机");
    }
    const max = this.endpoint.packetSize || 64;
    for (let off = 0; off < bytes.length; off += max) {
      const chunk = bytes.subarray(off, off + max);
      const res = await this.device.transferOut(
        this.endpoint.endpointNumber,
        chunk,
      );
      if (res.status !== "ok") {
        throw new Error(`打印机写入失败: ${res.status}`);
      }
    }
  }

  async printOrder(
    order: any,
    receiptSettings: ReceiptSettings | undefined,
    ticketType: "kitchen" | "addition" | "receipt",
    currency = "MAD",
  ): Promise<boolean> {
    if (!this.device || !this.endpoint) return false;
    const bytes = buildOrderTicket(
      order,
      receiptSettings,
      ticketType,
      currency,
    );
    await this.print(bytes);
    return true;
  }

  async printTest(
    receiptSettings: ReceiptSettings | undefined,
  ): Promise<boolean> {
    if (!this.device || !this.endpoint) return false;
    await this.print(buildTestTicket(receiptSettings));
    return true;
  }
}

export const usbPrinter = new UsbPrinterManager();

// 页面加载时静默重连之前授权过的 USB 打印机（WebUSB 连接不跨刷新保持）
usbPrinter.autoReconnect().catch(() => undefined);
