console.log('Скрипт script.js загружен');
// Основной объект приложения
const App = {
    map: null,
    modal: null,
    closeBtn: null,
    modalImage: null,
    swiper: null,
    locations: [],
    loader: null,
    currentRoute: null,
    // Вспомогательные функции для маршрута
    // Расстояние между двумя координатами в метрах (формула гаверсинусов)
    calculateDistance(coord1, coord2) {
        const [lat1, lon1] = coord1;
        const [lat2, lon2] = coord2;
        const R = 6371000; // радиус Земли в метрах
        const toRad = (deg) => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    // Форматирование времени в минутах
    formatDuration(minutes) {
        if (minutes < 60) {
            return `${Math.round(minutes)} мин`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`;
        }
    },

    // Инициализация
    async init() {
        console.log('App.init начал работу');
        this.setupElements();
        this.setupEventListeners();
        this.showLoader();
        await this.loadLocations();
        console.log('Локации загружены, инициализация карты');
        this.initMap();
        // hideLoader будет вызван внутри initMap после успешной загрузки карты или при ошибке
    },

    // Получить DOM элементы
    setupElements() {
        this.modal = document.getElementById('modal');
        this.closeBtn = document.querySelector('.close');
        this.modalImage = document.getElementById('modal-image');
        this.loader = document.getElementById('loader');
    },

    // Навесить обработчики событий
    setupEventListeners() {
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.hideModal();
            });
        } else {
            console.warn('Кнопка закрытия не найдена.');
        }
        // Клик вне модального окна закрывает его
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });
        // Обработка клавиши Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.hideModal();
            }
        });
    },

    // Инициализация Яндекс.Карт
    initMap() {
        console.log('initMap вызван');
        // Проверяем, загружена ли API Яндекс.Карт
        if (typeof ymaps === 'undefined') {
            console.error('Yandex Maps API не загружена.');
            this.showError('Не удалось загрузить Яндекс.Карты. Проверьте подключение к интернету и ключ API.');
            this.hideLoader();
            return;
        }

        // Таймаут на случай, если ymaps.ready никогда не вызовется
        const timeoutId = setTimeout(() => {
            console.warn('Таймаут загрузки Яндекс.Карт.');
            this.showError('Загрузка карты заняла слишком много времени. Попробуйте обновить страницу.');
            this.hideLoader();
        }, 10000); // 10 секунд

        // Центр карты — Санкт-Петербург
        ymaps.ready(() => {
            console.log('ymaps.ready вызван');
            clearTimeout(timeoutId);
            try {
                this.map = new ymaps.Map('map', {
                    center: [59.940824, 30.299687], // Центр трёх точек
                    zoom: 15,
                    controls: ['zoomControl', 'fullscreenControl']
                });
                console.log('Карта создана успешно', this.map);
                this.hideLoader();

                // После создания карты можно добавить метки и маршрут
                // Ошибки в этих функциях не должны ломать всю карту
                try {
                    this.addPlacemarks();
                } catch (err) {
                    console.error('Ошибка при добавлении меток:', err);
                }
                try {
                    this.addRoute();
                } catch (err) {
                    console.error('Ошибка при добавлении маршрута:', err);
                }
            } catch (error) {
                console.error('Ошибка при создании карты:', error);
                this.showError('Не удалось создать карту. Проверьте ключ API Яндекс.Карт.');
                this.hideLoader();
            }
        });
    },

    // Показать сообщение об ошибке
    showError(message) {
        console.log('showError:', message);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 1000; text-align: center; max-width: 400px;">
                <h3 style="margin-top: 0; color: #d32f2f;">Ошибка загрузки карты</h3>
                <p>${message}</p>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Обновить страницу</button>
            </div>
        `;
        document.body.appendChild(errorDiv);
        console.log('Сообщение об ошибке добавлено в DOM');
    },

    // Список markdown файлов с локациями
    markdownFiles: [
        'academy_arts.md',
        'academy_sciences.md',
        'vasilievsky_spit.md'
    ],

    // Загрузка данных локаций из markdown файлов
    async loadLocations() {
        this.locations = await this.loadLocationsFromMarkdown();
    },

    // Основная функция загрузки и парсинга markdown
    async loadLocationsFromMarkdown() {
        const locations = [];
        for (const filename of this.markdownFiles) {
            try {
                const response = await fetch(`md/${filename}`);
                if (!response.ok) {
                    console.warn(`Файл ${filename} не найден, пропускаем.`);
                    continue;
                }
                const text = await response.text();
                const location = this.parseMarkdownLocation(text);
                if (location) {
                    locations.push(location);
                }
            } catch (error) {
                console.error(`Ошибка загрузки ${filename}:`, error);
            }
        }
        // Сортировка по order
        locations.sort((a, b) => a.order - b.order);
        return locations;
    },

    // Парсинг одного markdown файла
    parseMarkdownLocation(text) {
        console.log('=== Начало парсинга markdown ===');
        // Разделяем front matter и контент
        const parts = text.split('---');
        console.log('Частей после split ---:', parts.length);
        if (parts.length < 3) {
            console.warn('Некорректный формат front matter');
            return null;
        }
        const frontMatter = parts[1].trim();
        const content = parts.slice(2).join('---').trim();
        console.log('frontMatter:', frontMatter);
        console.log('content длина:', content.length);

        // Парсинг YAML-like front matter
        const metadata = {};
        const lines = frontMatter.split('\n');
        console.log('Строки front matter:', lines);
        for (let line of lines) {
            // Удаляем символы \r и лишние пробелы
            line = line.trim();
            if (line.length === 0) continue; // пропускаем пустые строки
            // Улучшенное регулярное выражение: ключ может содержать буквы, цифры, подчёркивания
            const match = line.match(/^([a-zA-Z0-9_]+):\s*(.+)$/);
            if (match) {
                let key = match[1];
                let value = match[2].trim();
                console.log(`Строка совпала: ключ=${key}, значение=${value}`);
                // Обработка значений в кавычках (двойных или одинарных)
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                    console.log(`Убрали кавычки: ${value}`);
                }
                // Преобразование координат
                if (key === 'coordinates') {
                    // Ожидается строка типа "[59.9386, 30.2901]"
                    const coordMatch = value.match(/\[([\d.]+),\s*([\d.]+)\]/);
                    if (coordMatch) {
                        value = [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])];
                        console.log(`Координаты распарсены: ${value}`);
                    } else {
                        console.warn(`Неверный формат координат: ${value}`);
                        value = [0, 0];
                    }
                }
                // Преобразование order и id в числа
                if (key === 'order' || key === 'id') {
                    value = parseInt(value, 10);
                    console.log(`Числовое значение: ${value}`);
                }
                metadata[key] = value;
                // Отладочный лог
                console.log(`Парсинг: ${key} = ${JSON.stringify(value)}`);
            } else {
                console.log(`Строка не совпала с шаблоном: "${line}"`);
            }
        }

        // Извлечение фактов из контента
        const facts = this.extractFacts(content);

        const location = {
            id: metadata.id || 0,
            title: metadata.title || 'Без названия',
            coordinates: metadata.coordinates || [0, 0],
            image: metadata.image || '',
            order: metadata.order || 0,
            facts: facts
        };
        console.log('Распарсена локация:', location);
        console.log('=== Конец парсинга markdown ===');
        return location;
    },

    // Извлечение фактов из markdown контента
    extractFacts(content) {
        // Разбиваем на строки
        const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const facts = [];
        for (const line of lines) {
            // Пропускаем заголовки (начинаются с #)
            if (line.startsWith('#')) continue;
            // Если строка - элемент маркированного списка, убираем маркер
            if (line.startsWith('-') || line.startsWith('*')) {
                facts.push(line.substring(1).trim());
            } else {
                // Иначе добавляем как есть (можно разбить по точкам, но оставим пока)
                facts.push(line);
            }
        }
        // Если фактов нет, возвращаем пустой массив
        return facts.length > 0 ? facts : ['Информация отсутствует.'];
    },

    // Генерация HTML контента для балуна
    generateBalloonContent(location) {
        const firstFact = location.facts.length > 0 ? location.facts[0] : 'Интересный факт отсутствует.';
        const imageUrl = location.image || 'https://via.placeholder.com/280x160/4a90e2/ffffff?text=No+Image';
        return `
            <div class="balloon-custom">
                <img src="${imageUrl}" alt="${location.title}">
                <div class="balloon-content">
                    <h3>${location.title}</h3>
                    <p>${firstFact}</p>
                </div>
                <div class="balloon-footer">
                    Кликните для подробностей
                </div>
            </div>
        `;
    },

    // Создание HTML для оверлея
    createOverlayHTML(location) {
        const firstFact = location.facts.length > 0 ? location.facts[0] : 'Интересный факт отсутствует.';
        const imageUrl = location.image || 'https://via.placeholder.com/300x180/4a90e2/ffffff?text=No+Image';
        return `
            <div class="overlay-container">
                <img src="${imageUrl}" alt="${location.title}">
                <div class="overlay-content">
                    <h3>${location.title}</h3>
                    <p>${firstFact}</p>
                </div>
                <div class="overlay-footer">
                    Кликните на метку для подробностей
                </div>
            </div>
        `;
    },

    // Добавление меток и статических оверлеев
    addPlacemarks() {
        if (!this.map) {
            console.error('Карта не инициализирована.');
            return;
        }
        if (!this.locations.length) {
            console.warn('Нет локаций для отображения.');
            return;
        }

        const overlaysContainer = document.getElementById('overlays');
        if (!overlaysContainer) {
            console.error('Контейнер для оверлеев не найден.');
            return;
        }

        this.locations.forEach((loc, index) => {
            // Создаём метку для клика
            const placemark = new ymaps.Placemark(
                loc.coordinates,
                {
                    balloonContent: `<strong>${loc.title}</strong><br>Кликните для подробностей`
                },
                {
                    preset: 'islands#blueIcon'
                }
            );

            placemark.events.add('click', () => this.showLocation(loc));
            this.map.geoObjects.add(placemark);
            console.log('Метка добавлена:', loc.title, loc.coordinates);

            // Создаём оверлей
            const overlayElement = document.createElement('div');
            overlayElement.className = 'overlay-container';
            overlayElement.innerHTML = this.createOverlayHTML(loc);
            overlaysContainer.appendChild(overlayElement);

            // Позиционируем оверлей
            this.positionOverlay(overlayElement, loc.coordinates, index);
        });
    },

    // Позиционирование оверлея на карте
    positionOverlay(element, coordinates, index) {
        try {
            // Преобразуем координаты в пиксели относительно контейнера карты
            console.log('positionOverlay called', coordinates, this.map.converter);
            let pixelPosition;
            // Пробуем использовать coordinatesToPixel, если доступен
            if (this.map.converter && this.map.converter.coordinatesToPixel) {
                pixelPosition = this.map.converter.coordinatesToPixel(coordinates);
            } else if (this.map.converter && this.map.converter.globalToPage) {
                // fallback на globalToPage (старый метод)
                pixelPosition = this.map.converter.globalToPage(coordinates);
                // Вычитаем позицию контейнера карты, чтобы получить относительные координаты
                const container = this.map.getContainer();
                if (container && container.getBoundingClientRect) {
                    const containerRect = container.getBoundingClientRect();
                    pixelPosition[0] -= containerRect.left;
                    pixelPosition[1] -= containerRect.top;
                }
            } else {
                console.error('converter methods not found, using fallback');
                // Простой fallback: размещаем оверлеи в углу
                pixelPosition = [100 + index * 280, 100 + index * 100];
            }
            // Смещаем, чтобы оверлей не перекрывал метку
            const offsetX = -130; // половина ширины оверлея (260px)
            const offsetY = -180 - index * 15; // выше метки, меньше смещение
            element.style.left = (pixelPosition[0] + offsetX) + 'px';
            element.style.top = (pixelPosition[1] + offsetY) + 'px';
            console.log('positioned at', element.style.left, element.style.top, 'from pixel', pixelPosition);
        } catch (error) {
            console.error('Ошибка позиционирования оверлея:', error);
            // Размещаем оверлей в безопасном месте
            element.style.left = (100 + index * 280) + 'px';
            element.style.top = (100 + index * 100) + 'px';
        }
    },

    // Добавление пешеходного маршрута с расчётом времени
    addRoute() {
        if (!this.map) {
            console.error('Карта не инициализирована.');
            return;
        }
        if (this.locations.length < 2) {
            console.warn('Недостаточно локаций для построения маршрута.');
            return;
        }

        // Удаляем предыдущий маршрут, если есть
        if (this.currentRoute) {
            this.map.geoObjects.remove(this.currentRoute);
            this.currentRoute = null;
        }

        const points = this.locations
            .sort((a, b) => a.order - b.order)
            .map(loc => loc.coordinates);

        // Рассчитываем общее расстояние и время
        let totalDistance = 0; // в метрах
        for (let i = 0; i < points.length - 1; i++) {
            totalDistance += this.calculateDistance(points[i], points[i + 1]);
        }
        // Пешеходная скорость ~5 км/ч = 5000 м / 60 мин = 83.33 м/мин
        const walkingSpeedMperMin = 83.33;
        const totalMinutes = totalDistance / walkingSpeedMperMin;
        const formattedTime = this.formatDuration(totalMinutes);
        const formattedDistance = totalDistance >= 1000
            ? `${(totalDistance / 1000).toFixed(1)} км`
            : `${Math.round(totalDistance)} м`;

        // Создаём полилинию
        const polyline = new ymaps.Polyline(points, {}, {
            strokeColor: '#4a90e2',
            strokeWidth: 4,
            strokeOpacity: 0.7,
            balloonContentHeader: 'Пешеходный маршрут',
            balloonContentBody: `Примерное время: ${formattedTime}<br>Расстояние: ${formattedDistance}`
        });

        this.map.geoObjects.add(polyline);
        this.currentRoute = polyline;
    },

    // Показать модальное окно с информацией о локации
    showLocation(location) {
        if (!this.modal || !this.modalImage) {
            console.error('Модальные элементы не найдены.');
            return;
        }

        // Установить изображение
        this.modalImage.src = location.image;
        this.modalImage.alt = location.title;
        // Обработка ошибки загрузки изображения
        this.modalImage.onerror = () => {
            console.error('Не удалось загрузить изображение:', location.image);
            this.modalImage.src = ''; // можно установить placeholder
        };

        // Очистить и заполнить карусель фактов
        const swiperWrapper = document.querySelector('.swiper-wrapper');
        if (swiperWrapper) {
            swiperWrapper.innerHTML = '';
            location.facts.forEach(fact => {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.textContent = fact;
                swiperWrapper.appendChild(slide);
            });
        } else {
            console.warn('Элемент .swiper-wrapper не найден.');
        }

        // Инициализировать или обновить Swiper
        this.initSwiper();

        // Показать модальное окно
        this.modal.classList.remove('hidden');
    },

    // Инициализация Swiper
    initSwiper() {
        if (this.swiper) {
            this.swiper.update();
        } else {
            // Определяем количество слайдов
            const slideCount = document.querySelectorAll('.swiper-slide').length;
            // Отключаем loop, если слайдов меньше 3 (иначе Swiper выдаёт предупреждение)
            const enableLoop = slideCount >= 3;
            this.swiper = new Swiper('.swiper', {
                direction: 'horizontal',
                loop: enableLoop,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                autoplay: {
                    delay: 5000,
                },
            });
        }
    },

    // Показать индикатор загрузки
    showLoader() {
        console.log('showLoader вызван');
        if (this.loader) {
            this.loader.classList.remove('hidden');
        } else {
            console.warn('Элемент loader не найден');
        }
    },

    // Скрыть индикатор загрузки
    hideLoader() {
        console.log('hideLoader вызван');
        if (this.loader) {
            this.loader.classList.add('hidden');
        } else {
            console.warn('Элемент loader не найден');
        }
    },

    // Скрыть модальное окно
    hideModal() {
        this.modal.classList.add('hidden');
    }
};

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
});