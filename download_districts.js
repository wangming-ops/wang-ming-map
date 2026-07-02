const https = require('https');
const fs = require('fs');
const path = require('path');

// 直辖市（直接下钻到区县）
const MUNICIPALITIES = { '北京': 110000, '天津': 120000, '上海': 310000, '重庆': 500000 };

// 普通省份
const NORMAL_PROVINCES = {
    '河北': 130000, '山西': 140000, '内蒙古': 150000,
    '辽宁': 210000, '吉林': 220000, '黑龙江': 230000,
    '江苏': 320000, '浙江': 330000, '安徽': 340000, '福建': 350000,
    '江西': 360000, '山东': 370000, '河南': 410000, '湖北': 420000, '湖南': 430000,
    '广东': 440000, '广西': 450000, '海南': 460000,
    '四川': 510000, '贵州': 520000, '云南': 530000, '西藏': 540000,
    '陕西': 610000, '甘肃': 620000, '青海': 630000, '宁夏': 640000, '新疆': 650000
};

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                res.resume();
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(new Error(`JSON parse error: ${e.message}`)); }
            });
        }).on('error', reject);
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function downloadMunicipality(name, code) {
    // 直辖市直接就是区县数据
    console.log(`下载 ${name} (直辖市)...`);
    const data = await fetchJSON(`https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`);
    const filePath = path.join('districts', `${code}_districts.json`);
    fs.writeFileSync(filePath, JSON.stringify(data));
    console.log(`  ✓ ${data.features.length} 个区县`);
}

async function downloadProvince(name, code) {
    console.log(`\n处理 ${name}...`);
    const provinceData = await fetchJSON(`https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`);
    
    const allDistricts = { type: 'FeatureCollection', features: [] };
    
    for (const city of provinceData.features) {
        const cityCode = city.properties.adcode;
        const cityName = city.properties.name;
        try {
            const cityData = await fetchJSON(`https://geo.datav.aliyun.com/areas_v3/bound/${cityCode}_full.json`);
            // 检查 features 的 level，如果是 district 级别则添加
            const districts = cityData.features.filter(f => f.properties.level === 'district');
            if (districts.length > 0) {
                allDistricts.features.push(...districts);
            } else {
                // 如果没有 district 级别（如某些不设区的地级市），直接用全部 features
                allDistricts.features.push(...cityData.features);
            }
            await sleep(300);
        } catch (e) {
            console.log(`    ⚠ ${cityName} 下载失败: ${e.message}`);
        }
    }
    
    const filePath = path.join('districts', `${code}_districts.json`);
    fs.writeFileSync(filePath, JSON.stringify(allDistricts));
    console.log(`  ✓ 共 ${allDistricts.features.length} 个区县`);
}

async function main() {
    const dir = path.join(__dirname, 'districts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    // 直辖市
    for (const [name, code] of Object.entries(MUNICIPALITIES)) {
        try {
            await downloadMunicipality(name, code);
            await sleep(500);
        } catch(e) { console.error(`✗ ${name}: ${e.message}`); }
    }

    // 普通省份
    for (const [name, code] of Object.entries(NORMAL_PROVINCES)) {
        try {
            await downloadProvince(name, code);
            await sleep(500);
        } catch(e) { console.error(`✗ ${name}: ${e.message}`); }
    }

    console.log('\n✅ 全部完成！');
}

main();
