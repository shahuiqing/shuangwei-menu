import { api } from "../../api";
import { QRCodeCanvas } from "qrcode.react";
import { QrCode, List, X, Download } from "lucide-react";
import { drawBeautifulTableCard } from "../../utils/image";

interface QrTabProps {
  tables: any[];
  receiptSettings: any;
}

export function QrTab({ tables, receiptSettings }: QrTabProps) {
  const downloadTableCard = (tableNo: string, storeName: string) => {
    const qrCanvas = document.getElementById(`qr-${tableNo}`) as HTMLCanvasElement;
    if (!qrCanvas) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 1500;

    drawBeautifulTableCard(canvas, qrCanvas, tableNo, storeName);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Table-${tableNo}-Card.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
                <div className="space-y-6">
                  {/* Create Table QR Code */}
                  <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <QrCode size={20} className="text-orange-500" />{" "}
                      管理桌台二维码 (Manage Table QR Codes)
                    </h3>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        placeholder="输入桌号 (Enter Table Number)"
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                        id="qr-table-input"
                      />
                      <button
                        onClick={async () => {
                          const input = document.getElementById(
                            "qr-table-input",
                          ) as HTMLInputElement;
                          let tableNo = input.value.trim();
                          if (!tableNo) {
                            alert("请输入桌号 (Please enter a table number)");
                            return;
                          }
                          tableNo = tableNo.replace(/\//g, "-");
                          try {
                            const existing = await api.getTableQr(tableNo);
                            if (existing) {
                              alert("该桌台已存在 (Table already exists)");
                              return;
                            }
                            await api.createTableQr(tableNo);
                            input.value = "";
                            alert("添加成功 (Added successfully)");
                          } catch (e) {
                            alert("添加失败 (Failed to add)");
                          }
                        }}
                        className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-colors whitespace-nowrap"
                      >
                        添加桌台 (Add Table)
                      </button>
                    </div>
                  </div>

                  {/* Active Tables */}
                  <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <List size={20} className="text-orange-500" /> 所有桌台
                      (All Tables)
                    </h3>
                    {tables.length === 0 ? (
                      <p className="text-zinc-500 text-center py-8">
                        暂无桌台 (No tables available)
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tables.map((table) => (
                          <div
                            key={table.tableNo}
                            className={`bg-zinc-900 border ${table.active ? "border-orange-500/50" : "border-zinc-800"} rounded-xl p-4 flex flex-col items-center transition-colors`}
                          >
                            <div className="w-full flex justify-between items-start mb-4">
                              <div>
                                <span className="text-lg font-bold text-white">
                                  桌号: {table.tableNo}
                                </span>
                                <div
                                  className={`text-xs ${table.active ? "text-green-500" : "text-zinc-500"}`}
                                >
                                  {table.active
                                    ? "已开台 (Opened)"
                                    : "未开台 (Closed)"}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    await api.updateTableStatus(
                                      table.tableNo,
                                      !table.active,
                                    );
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${table.active ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-orange-600 text-white hover:bg-orange-500"}`}
                                >
                                  {table.active
                                    ? "清台 (Close)"
                                    : "开台 (Open)"}
                                </button>
                                <button
                                  onClick={async () => {
                                    if (
                                      confirm(
                                        `确定要删除桌台 ${table.tableNo} 吗？(Delete table?)`,
                                      )
                                    ) {
                                      await api.deleteTableQr(table.tableNo);
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-400 p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                                  title="删除 (Delete)"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="p-4 bg-white rounded-xl mb-4 w-fit opacity-100 hover:opacity-100 transition-opacity border-4 border-zinc-100 shadow-sm relative overflow-hidden">
                              {/* Decorative corners */}
                              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-orange-500 rounded-tl-xl"></div>
                              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-orange-500 rounded-tr-xl"></div>
                              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-orange-500 rounded-bl-xl"></div>
                              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-orange-500 rounded-br-xl"></div>
                              <div className="p-2">
                                <QRCodeCanvas
                                  id={`qr-${table.tableNo}`}
                                  value={`${window.location.origin}${window.location.pathname}?table=${table.tableNo}&key=${table.key}`}
                                  size={150}
                                  level={receiptSettings?.qrCodeLevel || "H"}
                                  fgColor={receiptSettings?.qrCodeFgColor || "#18181b"}
                                  bgColor={receiptSettings?.qrCodeBgColor || "#ffffff"}
                                  imageSettings={{
                                    src: receiptSettings?.topLogoUrl || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjU5ZTBiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMgMnY3YzAgMS4xLjkgMiAyIDJoNGEyIDIgMCAwIDAgMi0yVjIiLz48cGF0aCBkPSJNNyAydjIwIi8+PHBhdGggZD0iTTIxIDE1VjJ2MGE1IDUgMCAwIDAtNSA1djZjMCAxLjEuOSAyIDIgMmgzWm0wIDB2NyIvPjwvc3ZnPg==",
                                    height: 36,
                                    width: 36,
                                    excavate: true,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="text-xs text-zinc-500 text-center mb-3">
                              可打印此二维码贴在桌子上
                              <br />
                              (Print and stick to table)
                            </div>
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={() => {
                                  const url = `${window.location.origin}${window.location.pathname}?table=${table.tableNo}&key=${table.key}`;
                                  navigator.clipboard.writeText(url);
                                  alert("链接已复制 (Link copied)");
                                }}
                                className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                              >
                                复制链接
                              </button>
                              <button
                                onClick={() => {
                                  downloadTableCard(table.tableNo, receiptSettings.storeName);
                                }}
                                className="flex-1 py-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-lg"
                              >
                                <Download size={12} />
                                下载桌牌 (Download Card)
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
  );
}
