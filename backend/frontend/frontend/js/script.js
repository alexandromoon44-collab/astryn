function toggleSidebar(){

  document
  .getElementById('sidebar')
  .classList.toggle('show');

}

function showSection(sectionId, element){

    document.querySelectorAll(".section").forEach(section=>{
        section.style.display="none";
    });

    document.getElementById(sectionId).style.display="block";

    document.querySelectorAll(".menu-link").forEach(link=>{
        link.classList.remove("active");
    });

    if(element){
        element.classList.add("active");
    }

    if(window.innerWidth <= 768){
        document.getElementById("sidebar").classList.remove("show");
    }
}

// Cart entries look like { productId, name, price, quantity }.
// Kept in memory + localStorage so a refresh doesn't lose the cart,
// but the server never trusts these prices — see checkout().
let cart = [];

function loadCartFromStorage(){
  try {
    const saved = localStorage.getItem('astryn_cart');
    cart = saved ? JSON.parse(saved) : [];
  } catch(err){
    cart = [];
  }
}

function saveCartToStorage(){
  try {
    localStorage.setItem('astryn_cart', JSON.stringify(cart));
  } catch(err){
    // storage unavailable (private browsing, quota) — cart still works in-memory
  }
}

function addToCart(productId, name, price){

  let audio = new Audio(
  'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'
  );

  audio.volume = 0.2;
  audio.play().catch(()=>{ /* autoplay can be blocked — not fatal */ });

  const existing = cart.find(item => item.productId === productId);

  if(existing){
    existing.quantity += 1;
  } else {
    cart.push({ productId, name, price, quantity: 1 });
  }

  saveCartToStorage();
  renderCart();

  showNotification(name + ' added to cart');

}

function changeQuantity(productId, delta){

  const item = cart.find(i => i.productId === productId);
  if(!item) return;

  item.quantity += delta;

  if(item.quantity <= 0){
    cart = cart.filter(i => i.productId !== productId);
  }

  saveCartToStorage();
  renderCart();
}

function renderCart(){

  let cartItems =
  document.getElementById('cartItems');

  let cartTotal =
  document.getElementById('cartTotal');

  cartItems.innerHTML='';

  if(cart.length === 0){
    cartItems.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">Your cart is empty</td>
      </tr>
    `;
    cartTotal.innerText = '0.00';
    return;
  }

  let total = 0;

  cart.forEach((item)=>{

    total += item.price * item.quantity;

    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = item.name;

    const priceCell = document.createElement('td');
    priceCell.textContent = '$' + item.price.toFixed(2);

    const qtyCell = document.createElement('td');
    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'qty-controls';

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.textContent = '−';
    minusBtn.onclick = () => changeQuantity(item.productId, -1);

    const qtySpan = document.createElement('span');
    qtySpan.textContent = item.quantity;

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.textContent = '+';
    plusBtn.onclick = () => changeQuantity(item.productId, 1);

    qtyWrap.append(minusBtn, qtySpan, plusBtn);
    qtyCell.appendChild(qtyWrap);

    const actionCell = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deleteFromCart(item.productId);
    actionCell.appendChild(delBtn);

    row.append(nameCell, priceCell, qtyCell, actionCell);
    cartItems.appendChild(row);

  });

  cartTotal.innerText = total.toFixed(2);

}

let selectedPayment = 'ABA PayWay';

function selectPayment(button,method){

  selectedPayment = method;

  let buttons =
  document.querySelectorAll('.payment-btn');

  buttons.forEach(btn=>{
    btn.classList.remove('active');
  });

  button.classList.add('active');

}

let authMode = 'login';

function showRegister() {

  authMode = 'register';

  document.getElementById('formTitle').innerText = 'REGISTER';
  document.getElementById('username').style.display = 'block';
  document.getElementById('authError').innerText = '';

  const primaryBtn = document.getElementById('primaryAuthBtn');
  primaryBtn.innerText = 'CREATE ACCOUNT';

  document.getElementById('toggleAuthBtn').innerText = 'BACK TO LOGIN';
}

function showLogin() {

  authMode = 'login';

  document.getElementById('formTitle').innerText = 'LOGIN';
  document.getElementById('username').style.display = 'none';
  document.getElementById('authError').innerText = '';

  const primaryBtn = document.getElementById('primaryAuthBtn');
  primaryBtn.innerText = 'LOGIN';

  document.getElementById('toggleAuthBtn').innerText = 'REGISTER';
}

function setAuthError(message){
  document.getElementById('authError').innerText = message || '';
}

async function register() {

  const username =
    document.getElementById("username").value.trim();

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  if(!username || !email || !password){
    setAuthError('Please fill in every field');
    return;
  }

  setAuthError('');

  const btn = document.getElementById('primaryAuthBtn');
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerText = 'Creating...';

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        email,
        password
      })
    });

    const data = await response.json();

    if(data.success){
      showNotification('Account created — you can log in now');
      showLogin();
      document.getElementById('loginEmail').value = email;
    } else {
      setAuthError(data.message || 'Could not create account');
    }
  } catch(err){
    setAuthError('Network error — please try again');
  } finally {
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

async function login() {

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  if(!email || !password){
    setAuthError('Please enter your email and password');
    return;
  }

  setAuthError('');

  const btn = document.getElementById('primaryAuthBtn');
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerText = 'Logging in...';

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (data.success) {
      applyLoggedInUI(data);
      showNotification('Login successful');
      await renderOrders();
      await refreshAdminVisibility(data.role);
    } else {
      setAuthError(data.message || 'Invalid credentials');
    }
  } catch(err){
    setAuthError('Network error — please try again');
  } finally {
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

function applyLoggedInUI(user){

  document.getElementById("accountName").innerText = user.username;
  document.getElementById("accountEmail").innerText = user.email;

  document.getElementById("loginBox").style.display = "none";
  document.getElementById("accountBox").style.display = "flex";
}

async function logout() {

  await fetch('/api/logout', {
    method: 'POST'
  });

  document.getElementById('loginBox').style.display = 'flex';
  document.getElementById('accountBox').style.display = 'none';

  document.getElementById('orderHistory').innerHTML =
    '<tr><td colspan="4" class="empty-state">Log in to see your orders</td></tr>';

  document.getElementById('adminNavLink').style.display = 'none';

  showSection('home', document.querySelector('.menu-link'));
  showLogin();
}

async function checkout(){

  if(cart.length === 0){
    showNotification('Cart is empty');
    return;
  }

  const meResponse = await fetch('/api/me');

  if(meResponse.status !== 200){
    showNotification('Please login first');
    showSection('account');
    return;
  }

  const checkoutBtn = document.querySelector('.checkout-btn');
  const originalText = checkoutBtn.innerText;
  checkoutBtn.disabled = true;
  checkoutBtn.innerText = 'Placing order...';

  try {
    const items = cart.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    }));

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items,
        payment: selectedPayment
      })
    });

    const data = await response.json();

    if(!data.success){
      showNotification(data.message || 'Failed to place order');
      return;
    }

    cart = [];
    saveCartToStorage();
    renderCart();
    await renderOrders();
    showNotification('Order placed!');
    showSection('orders', document.querySelectorAll('.menu-link')[3]);

  } catch(err){
    showNotification('Network error — order not placed');
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.innerText = originalText;
  }
}

function showNotification(text){

  let notify = document.createElement('div');

  notify.textContent = text;

  notify.style.position = 'fixed';
  notify.style.top = '30px';
  notify.style.right = '30px';
  notify.style.padding = '16px 24px';
  notify.style.borderRadius = '15px';
  notify.style.background = 'linear-gradient(135deg,#0A0F1E,#E4F0F6)';
  notify.style.zIndex = '99999';
  notify.style.boxShadow = '0 0 20px rgba(183,0,255,.7)';

  document.body.appendChild(notify);

  setTimeout(()=>{
    notify.remove();
  },2500);

}

async function refreshAdminVisibility(role){

  const adminLink = document.getElementById('adminNavLink');

  if(role === 'admin'){
    adminLink.style.display = 'flex';
    try {
      await loadAdminStats();
      await loadAdminOrders();
      await loadAdminUsers();
    } catch(err){
      console.log('Failed to load admin data', err);
    }
  } else {
    adminLink.style.display = 'none';
  }
}

function bindEvents(){

  document.getElementById('menuBtn').addEventListener('click', toggleSidebar);

  document.querySelectorAll('.menu-link[data-section]').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      showSection(link.dataset.section, link);
    });
  });

  const heroBtn = document.getElementById('heroOrderBtn');
  if(heroBtn){
    heroBtn.addEventListener('click', () => {
      const productsLink = document.querySelector('.menu-link[data-section="products"]');
      showSection('products', productsLink);
    });
  }

  const searchInput = document.getElementById('searchProduct');
  if(searchInput){
    searchInput.addEventListener('keyup', searchProducts);
  }

  document.querySelectorAll('.payment-btn[data-payment]').forEach(btn => {
    btn.addEventListener('click', () => selectPayment(btn, btn.dataset.payment));
  });

  const checkoutBtn = document.getElementById('checkoutBtn');
  if(checkoutBtn){
    checkoutBtn.addEventListener('click', checkout);
  }

  document.getElementById('primaryAuthBtn').addEventListener('click', () => {
    if(authMode === 'register'){
      register();
    } else {
      login();
    }
  });

  document.getElementById('toggleAuthBtn').addEventListener('click', () => {
    if(authMode === 'register'){
      showLogin();
    } else {
      showRegister();
    }
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn){
    logoutBtn.addEventListener('click', logout);
  }

}

window.onload = async () => {

  bindEvents();
  showSection('home');
  loadCartFromStorage();
  renderCart();

  try {
    await loadProducts();
  } catch(err){
    console.log('Failed to load products', err);
  }

  try {

    const response = await fetch('/api/me');

    if(response.status === 200){

      const user = await response.json();

      applyLoggedInUI(user);
      await renderOrders();
      await refreshAdminVisibility(user.role);

    } else {
      document.getElementById('orderHistory').innerHTML =
        '<tr><td colspan="4" class="empty-state">Log in to see your orders</td></tr>';
    }

  } catch(err){
    console.log('Not logged in');
  }

};

console.log("JS LOADED");

function searchProducts(){

  let value =
  document.getElementById('searchProduct')
  .value
  .toLowerCase();

  let cards =
  document.querySelectorAll('#productContainer .card');

  cards.forEach(card=>{

    let name =
    card.querySelector('h2')
    .innerText
    .toLowerCase();

    if(name.includes(value)){
      card.style.display = 'block';
    }else{
      card.style.display = 'none';
    }

  });

}

function deleteFromCart(productId){

  cart = cart.filter(item => item.productId !== productId);

  saveCartToStorage();
  renderCart();
  showNotification('Item removed');

}

async function renderOrders(){

  let history =
  document.getElementById('orderHistory');

  if(!history) return;

  const response =
  await fetch('/api/orders');

  if(response.status !== 200){
    history.innerHTML =
      '<tr><td colspan="4" class="empty-state">Log in to see your orders</td></tr>';
    return;
  }

  const orders =
  await response.json();

  history.innerHTML = '';

  if(orders.length === 0){
    history.innerHTML =
      '<tr><td colspan="4" class="empty-state">No orders yet — go grab a coffee</td></tr>';
    return;
  }

  orders.forEach(order=>{

    const row = document.createElement('tr');

    const idCell = document.createElement('td');
    idCell.textContent = '#' + order.id;

    const itemsCell = document.createElement('td');
    const list = document.createElement('ul');
    list.className = 'order-items-list';
    (order.items || []).forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.name} x${item.quantity}`;
      list.appendChild(li);
    });
    itemsCell.appendChild(list);

    const totalCell = document.createElement('td');
    totalCell.textContent = '$' + Number(order.total).toFixed(2);

    const paymentCell = document.createElement('td');
    paymentCell.textContent = order.payment;

    row.append(idCell, itemsCell, totalCell, paymentCell);
    history.appendChild(row);

  });

}

async function loadAdminStats(){

  const response =
  await fetch('/api/admin/stats');

  if(response.status !== 200){
    return;
  }

  const data =
  await response.json();

  document.getElementById('totalUsers')
  .innerText = data.users;

  document.getElementById('totalOrders')
  .innerText = data.orders;

  document.getElementById('totalRevenue')
  .innerText = '$' + Number(data.revenue).toFixed(2);

}

async function loadAdminOrders(){

  const response = await fetch('/api/admin/orders');

  if(response.status !== 200) return;

  const orders = await response.json();

  const tbody = document.getElementById('adminOrders');
  tbody.innerHTML = '';

  if(orders.length === 0){
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No orders yet</td></tr>';
    return;
  }

  orders.forEach(order=>{
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>#${order.id}</td>
      <td></td>
      <td>$${Number(order.total).toFixed(2)}</td>
      <td></td>
      <td>${order.created_at}</td>
    `;
    row.children[1].textContent = order.user_email;
    row.children[3].textContent = order.payment;
    tbody.appendChild(row);
  });

}

async function loadAdminUsers(){

  const response = await fetch('/api/admin/users');

  if(response.status !== 200) return;

  const users = await response.json();

  const tbody = document.getElementById('adminUsers');
  tbody.innerHTML = '';

  users.forEach(user=>{
    const row = document.createElement('tr');
    row.innerHTML = `
      <td></td>
      <td></td>
      <td>${user.role}</td>
      <td>${user.created_at}</td>
    `;
    row.children[0].textContent = user.username;
    row.children[1].textContent = user.email;
    tbody.appendChild(row);
  });

}

async function loadProducts(){

  const response =
  await fetch('/api/products');

  const products =
  await response.json();

  const container =
  document.getElementById('productContainer');

  container.innerHTML = '';

  products.forEach(product=>{

    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.src = product.image;
    img.className = 'product-img';
    img.alt = product.name;

    const title = document.createElement('h2');
    title.textContent = product.name;

    const price = document.createElement('p');
    price.textContent = '$' + Number(product.price).toFixed(2);

    const btn = document.createElement('button');
    btn.className = 'add-btn';
    btn.textContent = 'Add To Cart';
    btn.onclick = () => addToCart(product.id, product.name, product.price);

    card.append(img, title, price, btn);
    container.appendChild(card);

  });

}
