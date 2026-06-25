const res = await fetch('https://raw.githubusercontent.com/victorchen96/deepseek_v4_rolepaly_instruct/main/README.md');
const text = await res.text();
console.log(text);
