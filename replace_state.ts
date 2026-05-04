import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/const \[historyFilter, setHistoryFilter\] = useState<.*?\(.*?\);/g, "const [periodFilter, setPeriodFilter] = useState<'day' | 'week' | 'month'>('week');");
content = content.replace(/const \[historyReferenceDate, setHistoryReferenceDate\] = useState\(new Date\(\)\);/g, "const [referenceDate, setReferenceDate] = useState(new Date());");

content = content.replace(/const \[insightFilter, setInsightFilter\] = useState<.*?>\(.*?\);\n/g, "");
content = content.replace(/const \[insightReferenceDate, setInsightReferenceDate\] = useState\(new Date\(\)\);\n/g, "");

content = content.replace(/historyFilter/g, 'periodFilter');
content = content.replace(/setHistoryFilter/g, 'setPeriodFilter');
content = content.replace(/historyReferenceDate/g, 'referenceDate');
content = content.replace(/setHistoryReferenceDate/g, 'setReferenceDate');

content = content.replace(/insightFilter/g, 'periodFilter');
content = content.replace(/setInsightFilter/g, 'setPeriodFilter');
content = content.replace(/insightReferenceDate/g, 'referenceDate');
content = content.replace(/setInsightReferenceDate/g, 'setReferenceDate');

fs.writeFileSync('src/App.tsx', content);

console.log("Replaced variables in src/App.tsx");
