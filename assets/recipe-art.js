function pieces(count, rx, ry, draw) {
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.39996;
    const radius = Math.sqrt((index + 0.5) / count);
    return draw(180 + Math.cos(angle) * radius * rx, 109 + Math.sin(angle) * radius * ry, index);
  }).join('');
}

function grain(color, count = 85) {
  return pieces(count, 97, 49, (x, y, i) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="1.6" fill="${color}" transform="rotate(${i * 41} ${x} ${y})"/>`);
}

function beans(color, count = 18) {
  return pieces(count, 87, 42, (x, y, i) => `<g transform="translate(${x} ${y}) rotate(${i * 57})"><ellipse rx="8" ry="5.5" fill="${color}" stroke="#73543d" stroke-opacity=".15"/><path d="M-3-1q4-3 6 1" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/></g>`);
}

function cubes(color, count = 15, size = 14) {
  return pieces(count, 88, 43, (x, y, i) => `<g transform="translate(${x} ${y}) rotate(${i * 37})"><rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="3" fill="${color}" stroke="#825b38" stroke-opacity=".18"/><path d="M${-size / 2 + 3} ${-size / 2 + 3}h${size - 6}" stroke="#fff" stroke-opacity=".35" stroke-width="2"/></g>`);
}

function leaves(count = 9) {
  return pieces(count, 85, 43, (x, y, i) => `<g transform="translate(${x} ${y}) rotate(${i * 71})"><path d="M-13 0q13-18 26 0-13 18-26 0" fill="${i % 2 ? '#52764c' : '#779954'}"/><path d="M-10 0h19" stroke="#b4c386" stroke-width="1.3"/></g>`);
}

function peas(count = 20) {
  return pieces(count, 88, 43, (x, y) => `<circle cx="${x}" cy="${y}" r="4.3" fill="#79a25c" stroke="#587f48" stroke-width="1"/><circle cx="${x - 1}" cy="${y - 1}" r="1.2" fill="#bfd296"/>`);
}

const lemon = '<g transform="translate(274 142) rotate(-23)"><path d="M-20 0a20 20 0 0 0 40 0Z" fill="#e1b54d" stroke="#fff2b0" stroke-width="4"/><path d="m0 1-13 9m13-9v14m0-14 13 9" stroke="#fff2b0" stroke-width="2"/></g>';
const drizzle = '<path d="m117 79 113 12-106 15 108 13-91 15 67 9" fill="none" stroke="#f4e7c2" stroke-width="4" stroke-linecap="round" opacity=".9"/>';
const dishes = {
  'lemon-chickpea-couscous': {
    label: 'Illustration of couscous with chickpeas, cucumber and a lemon wedge.',
    base: '#ddc482', body: grain('#f2dda2', 120) + beans('#d9ae61') + cubes('#95b485', 12, 10) + lemon,
  },
  'smoky-black-bean-rice': {
    label: 'Illustration of a tomato rice skillet with black beans and red pepper.',
    vessel: 'pan', base: '#bd7044',
    body: grain('#e7ab65') + beans('#443c35', 22) + cubes('#c84935', 13, 11),
  },
  'tomato-red-lentil-pot': {
    label: 'Illustration of a pot of red lentils, tomato and diced carrot.',
    vessel: 'pot', base: '#c3633c',
    body: grain('#e38f54', 100) + cubes('#eb9c4c', 13, 11) + beans('#d67e44', 12),
  },
  'ginger-tofu-broccoli-rice': {
    label: 'Illustration of golden tofu and broccoli florets served over rice.',
    base: '#eadfc0', body: grain('#fff4d8') + cubes('#d9a25c', 13, 20)
      + pieces(9, 87, 43, (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 5v10" stroke="#8ba663" stroke-width="6"/><path d="M-12 2q-9-10 2-13 4-10 13-4 12-2 12 9 10 12-6 14H-7q-9 0-5-6" fill="#547b4c"/><circle cy="-6" r="4" fill="#779b58"/></g>`),
  },
  'spinach-feta-potato-skillet': {
    label: 'Illustration of golden potatoes, spinach leaves and crumbled feta in a skillet.',
    vessel: 'pan', base: '#a5a36b', body: leaves(14) + cubes('#d6ae65', 17, 20) + cubes('#fff3d4', 15, 8),
  },
  'white-bean-tomato-toast': {
    label: 'Illustration of crisp toast topped with white beans and diced tomato.',
    base: '#f4ecd8',
    body: '<g transform="rotate(-12 158 109)"><rect x="92" y="65" width="100" height="90" rx="18" fill="#ae7549"/><rect x="98" y="71" width="88" height="77" rx="14" fill="#e1b779"/></g><g transform="rotate(12 219 112)"><rect x="170" y="68" width="95" height="88" rx="18" fill="#ae7549"/><rect x="176" y="74" width="83" height="76" rx="14" fill="#e1b779"/></g>'
      + cubes('#c95d43', 19, 12) + beans('#eee1b5', 25),
  },
  'peanut-carrot-rice-noodles': {
    label: 'Illustration of rice noodles with carrot ribbons and a peanut sauce.',
    base: '#cfb27a',
    body: Array.from({ length: 10 }, (_, i) => `<path d="M${103 + i * 7} 76c95-23 89 21 3 22s-34 34 58 22-25 43-34 26" fill="none" stroke="${i % 2 ? '#f2d89b' : '#e5c181'}" stroke-width="5" stroke-linecap="round"/>`).join('')
      + '<path d="M123 80q110 37 4 41m32-50q115 43 40 68m-93-37q100 51 142 6" fill="none" stroke="#dc8b45" stroke-width="5" stroke-linecap="round"/>',
  },
  'creamy-mushroom-pea-pasta': {
    label: 'Illustration of creamy pasta with sliced mushrooms and green peas.',
    base: '#d8c6a1',
    body: pieces(28, 91, 45, (x, y, i) => `<g transform="translate(${x} ${y}) rotate(${i * 47})"><rect x="-12" y="-4" width="24" height="8" rx="2" fill="#ead39b" stroke="#b5a078"/><path d="M-8-2H8m-16 4H8" stroke="#fff2ca"/></g>`)
      + pieces(9, 78, 40, (x, y, i) => `<g transform="translate(${x} ${y}) rotate(${i * 61})"><path d="M-13 0a13 10 0 0 1 26 0H4v9h-8V0Z" fill="#ad9981" stroke="#806c57" stroke-width="1.5"/><path d="M-8-2H8" stroke="#d6c6ab" stroke-width="2"/></g>`) + peas(17),
  },
  'sweet-potato-chickpea-tray': {
    label: 'Illustration of a roasting tray of sweet potato, chickpeas and tahini drizzle.',
    vessel: 'tray', base: '#7c796b', body: cubes('#d78f43', 25, 20) + beans('#d9b16c', 24) + drizzle,
  },
  'courgette-pea-risotto': {
    label: 'Illustration of creamy risotto with courgette pieces and green peas.',
    base: '#e4d7ae', body: grain('#f3e7c3', 110) + cubes('#a1b584', 13, 14) + peas(28),
  },
  'red-pepper-butter-bean-stew': {
    label: 'Illustration of a tomato stew with butter beans and red pepper.',
    vessel: 'pot', base: '#bd5d3d', body: beans('#ebd7a5', 27) + cubes('#d58047', 15, 13),
  },
  'coconut-spinach-lentil-curry': {
    label: 'Illustration of golden lentil curry with spinach and coconut milk.',
    base: '#d2ad54', body: grain('#e7c579', 100) + leaves(14)
      + '<path d="M122 95q65-46 112 4t-72 41q-49-12-11-25t52 3" fill="none" stroke="#f2e6c6" stroke-width="4" stroke-linecap="round"/>',
  },
};

export function recipeArtwork(id) {
  const dish = dishes[id];
  if (!dish) return '';
  let vessel = '<ellipse cx="180" cy="122" rx="122" ry="72" fill="#d7ccaf"/><ellipse cx="180" cy="109" rx="119" ry="68" fill="#fff9e7"/>';
  if (dish.vessel === 'pan' || dish.vessel === 'pot') {
    vessel = `<path d="M71 105H40m248 0h32" stroke="#68675a" stroke-width="15" stroke-linecap="round"/><ellipse cx="180" cy="119" rx="116" ry="65" fill="#5a6054"/><ellipse cx="180" cy="108" rx="116" ry="64" fill="#7e8371"/>`;
    if (dish.vessel === 'pan') vessel += '<path d="m276 149 53 24" stroke="#565d51" stroke-width="16" stroke-linecap="round"/>';
  } else if (dish.vessel === 'tray') {
    vessel = '<rect x="57" y="41" width="246" height="142" rx="17" fill="#656b60"/><rect x="64" y="48" width="232" height="128" rx="12" fill="#aaa58b"/>';
  }
  return `<svg class="recipe-illustration" data-recipe-art="${id}" viewBox="0 0 360 210" role="img" aria-label="${dish.label}" focusable="false"><ellipse cx="182" cy="173" rx="120" ry="12" fill="#52613f" opacity=".12"/>${vessel}<ellipse cx="180" cy="109" rx="106" ry="56" fill="${dish.base}"/>${dish.body}</svg>`;
}
