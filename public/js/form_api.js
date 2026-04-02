const schoolInput = document.getElementById('school_input');
const resultsList = document.getElementById('results_list');
let debounceTimer;

if (schoolInput && resultsList) {
    schoolInput.addEventListener('input', function() {
        const keyword = this.value.trim();
        
        clearTimeout(debounceTimer);
        if (!keyword) {
            resultsList.style.display = 'none';
            return;
        }
        // 延迟 300ms 发送请求
        debounceTimer = setTimeout(() => {
            fetch(window.API_URL)
                .then(res => res.json())
                .then(JsonData => {
                    const data = JsonData.data;
                    const keyword = schoolInput.value.trim().toLowerCase();
                    
                    //只保留包含关键字的结果
                    const filteredData = data.filter(item => 
                        item.name.toLowerCase().includes(keyword) || (item.addr && item.addr.toLowerCase().includes(keyword))
                    );

                    renderSchools(filteredData);
                })
                .catch(err => console.error("搜索失败:", err));
        }, 300);
    });

    function renderSchools(schools) {
        resultsList.replaceChildren();
        
        if (schools.length === 0) {
            resultsList.style.display = 'none';
            return;
        }

        schools.forEach(item => {
            const div = document.createElement('div');
            const title = document.createElement('span');

            div.className = 'result-item';
            title.className = 'school-title';
            title.textContent = item.name || '';
            div.appendChild(title);
            
            div.onclick = () => {
                schoolInput.value = item.name; // 填充输入框
                resultsList.style.display = 'none'; // 隐藏列表
            };
            
            resultsList.appendChild(div);
        });

        resultsList.style.display = 'block';
    }

    // 点击页面其他地方时隐藏列表
    document.addEventListener('click', (e) => {
        if (e.target !== schoolInput) {
            resultsList.style.display = 'none';
        }
    });
}
