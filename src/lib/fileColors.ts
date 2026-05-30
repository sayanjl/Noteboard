const colorMap: Record<string, string> = {};

const groups: [string, string[]][] = [
  ["#22c55e", ["xlsx","xls","csv","numbers"]],
  ["#3b82f6", ["docx","doc","pages","txt","md","rtf"]],
  ["#f97316", ["pptx","ppt","keynote"]],
  ["#ef4444", ["pdf"]],
  ["#a855f7", ["zip","rar","7z","tar","gz"]],
  ["#eab308", ["js","ts","tsx","jsx","py","rs","go","java","cpp","c","h","rb","php","html","css","json","yaml","toml","sh"]],
  ["#ec4899", ["mp3","wav","flac","m4a","ogg"]],
  ["#06b6d4", ["mp4","mov","avi","mkv","webm"]],
];

for (const [color, exts] of groups) {
  for (const ext of exts) colorMap[ext] = color;
}

export function getFileColor(ext: string): string {
  return colorMap[ext.toLowerCase()] ?? "#6b7280";
}
