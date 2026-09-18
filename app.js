function uiIcon(name){const paths={arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',car:'<path d="m4 10 2-6h12l2 6M3 10h18v8H3zM6 18v3m12-3v3M6 14h2m8 0h2"/>',bell:'<path d="M6 9a6 6 0 0 1 12 0v6l2 2H4l2-2zm4 11h4"/>',back:'<path d="m14 5-7 7 7 7M7 12h14"/>'};return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.car)+'</svg>';}
function carArt(){return '<svg class="car-art" viewBox="0 0 240 112" aria-hidden="true"><ellipse cx="121" cy="97" rx="99" ry="8" fill="#000" opacity=".08"/><path d="m30 65 19-8 25-30h73l37 30 32 8 8 23H22z" fill="#d9d9d9"/><path d="m77 32-19 25h47V32zm36 0v25h59l-29-25z" fill="#282828"/><path d="M24 74h194M113 60v23" stroke="#999" stroke-width="2"/><rect x="118" y="64" width="12" height="3" rx="1.5" fill="#777"/><path d="M26 65h19v7H24m179-6h14l3 8h-17" fill="#fafafa"/><circle cx="61" cy="87" r="16" fill="#161616"/><circle cx="61" cy="87" r="7" fill="#aaa"/><circle cx="184" cy="87" r="16" fill="#161616"/><circle cx="184" cy="87" r="7" fill="#aaa"/></svg>';}
function uiSafe(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const camps=['Smara / السمارة','El Aaiún / العيون','Auserd / أوسرد','Dajla / الداخلة','Rabuni / الرابوني','Tindouf / تندوف'];
const E={title:'Tu viaje, más cerca',sub:'Viajes dentro de los campamentos, entre ellos y a Tindouf.',loc:'Activa y permite la ubicación para usar Taxily.',origin:'Origen',dest:'Destino',when:'¿Cuándo quieres viajar?',now:'Ahora',later:'Reservar',date:'Fecha',time:'Hora',pass:'Pasajeros',request:'Solicitar viaje',role:'¿Cómo quieres usar Taxily?',passenger:'Pasajero',driver:'Conductor',history:'Historial de viajes',search:'Buscando conductor...',found:'¡Conductor encontrado!',confirm:'Confirmar viaje',back:'Volver'};
const A={title:'رحلتك أقرب إليك',sub:'رحلات داخل المخيمات وبينها وإلى تندوف.',loc:'فعّل الموقع واسمح للتطبيق باستخدامه.',origin:'نقطة الانطلاق',dest:'الوجهة',when:'متى تريد السفر؟',now:'الآن',later:'حجز',date:'التاريخ',time:'الوقت',pass:'عدد الركاب',request:'طلب الرحلة',role:'كيف تريد استخدام Taxily؟',passenger:'راكب',driver:'سائق',history:'سجل الرحلات',search:'جاري البحث عن سائق...',found:'تم العثور على سائق!',confirm:'تأكيد الرحلة',back:'رجوع'};
let lang='es',role=null,accountMode=null,account=loadAccount(),timing='now',o='',d='',currentTripId=null,pollTimer=null,lastTripStatus='',driverLocation=null,tripMap=null,driverMarker=null,locationWatcher=null,sharingTripId=null,passengerConfirmed=false,profileRole=null,driverPollTimer=null,currentDriverTripId=null,driverNoticeTimer=null,knownPendingTrips=new Set(),reminderSeen=new Set(),currentPrice=300;
const t=()=>lang==='es'?E:A;
let bookingDraft=null, bookingAccess=false, submittingTrip=false, rideMode='pasajeros', pickupMode='campamento';
function rememberBooking(){
  if(!document.querySelector('#d'))return;
  bookingDraft={origen:document.querySelector('#o')?.value||bookingDraft?.origen||'',destino:document.querySelector('#d').value,pasajeros:document.querySelector('#pax')?.value||bookingDraft?.pasajeros||'1',fecha:document.querySelector('#date')?.value||bookingDraft?.fecha||'',hora:document.querySelector('#time')?.value||bookingDraft?.hora||''};
}
function restoreBooking(){
  if(!bookingDraft||!document.querySelector('#d'))return;
  for(const [id,key] of [['o','origen'],['d','destino'],['pax','pasajeros'],['date','fecha'],['time','hora']]){
    const element=document.querySelector('#'+id);if(element)element.value=bookingDraft[key];
  }
}
function requireBookingAccount(){bookingAccess=true;accountMode='login';role='p';render();}
function cancelAccountForm(){accountMode=null;bookingAccess=false;render();}
function loadAccount(){try{return JSON.parse(localStorage.getItem('saharago_session'));}catch(error){return null;}}
function saveAccount(perfil){account=perfil;localStorage.setItem('saharago_session',JSON.stringify(perfil));}
async function logout(){try{const response=await fetch('/api/cuentas/salir',{method:'POST'});if(!response.ok)throw Error();localStorage.removeItem('saharago_session');account=null;role=null;bookingDraft=null;bookingAccess=false;render();}catch{alert(lang==='es'?'No se pudo cerrar la sesión. Inténtalo de nuevo.':'تعذر تسجيل الخروج. حاول مرة أخرى.');}}
function selectRole(r){
  if(r==='h'){role='h';render();return;}
  if(r==='p'){role='p';render();return;}
  if(r==='d'){
    bookingAccess=false;profileRole='d';
    if(account?.tipo!=='conductor'){role=null;accountMode='register';render();return;}
    role='d';render();return;
  }
  profileRole=r;
  if(!getProfile(r)){role='profile';render();return;}
  role = r;
  render();
}
function getProfile(tipo){const accountType=tipo==='d'?'conductor':tipo==='p'?'pasajero':tipo;if(account&&account.tipo===accountType)return account;try{return JSON.parse(localStorage.getItem('saharago_'+tipo));}catch(error){return null;}}
function showNotice(message){const anterior=document.querySelector('.toast');if(anterior)anterior.remove();const aviso=document.createElement('div');aviso.className='toast';aviso.textContent=message;document.body.appendChild(aviso);setTimeout(()=>aviso.remove(),4000);if('Notification' in window&&Notification.permission==='granted')new Notification('Taxily',{body:message});}
async function enableNotifications(){if(!('Notification' in window)){alert('Las notificaciones no están disponibles.');return;}const permiso=await Notification.requestPermission();showNotice(permiso==='granted'?'🔔 Notificaciones activadas.':'Las notificaciones no fueron activadas.');}
function render(){let x=t();document.body.classList.toggle('rtl',lang==='ar');document.querySelector('#lang').textContent=lang==='es'?'العربية':'Español';document.querySelector('#screen').innerHTML=accountMode?accountForm():!role?home(x):role==='account'?`<div class="card"><h2>👤 Mi perfil</h2><p><b>${account.nombre}</b><br>${account.tipo==='conductor'?'🚗 Conductor':'👤 Pasajero'}${account.vehiculo?`<br>${account.vehiculo}${account.matricula?' · '+account.matricula:''}`:''}</p><div id="accountStats" class="notice">Cargando datos...</div><button class="secondary" onclick="role=null;render()">Volver</button></div>`:role==='profile'?profileForm(x):role==='p'?booking(x):role==='d'?driver(x):history(x);if(accountMode==='register')toggleCarFields();if(role==='h')loadHistory();if(role==='p'&&!accountMode)restoreBooking();}
function goHome(){rememberBooking();role=null;render();}
function home(x){const es=lang==='es';return `<section class="home-intro"><span class="eyebrow">${es?'CAMPAMENTOS · TINDOUF':'المخيمات · تندوف'}</span><h1>${es?'¿A dónde<br>vamos?':'إلى أين<br>نذهب؟'}</h1><p>${es?'Tu próximo viaje empieza aquí.':'رحلتك القادمة تبدأ هنا.'}</p></section><button class="ride-hero" onclick="selectRole('p')"><span class="hero-copy"><strong>${es?'Pedir un viaje':'اطلب رحلة'}</strong><span>${es?'Te recogemos donde estés.':'نأتي إليك أينما كنت.'}</span><span class="round-arrow">${uiIcon('arrow')}</span></span>${carArt()}</button><section class="quick-section"><div class="section-title"><h2>${es?'A tu manera':'كما يناسبك'}</h2><span>${es?'Ahora o con reserva':'الآن أو بالحجز'}</span></div><div class="service-grid"><button class="service-tile" onclick="rideMode='completo';selectRole('p')">${uiIcon('car')}<strong>${es?'Coche completo':'السيارة كاملة'}</strong><span>${es?'Un coche para ti':'سيارة لك'}</span></button><button class="service-tile" onclick="rideMode='pasajeros';selectRole('p')">${uiIcon('person')}<strong>${es?'Por pasajeros':'حسب عدد الركاب'}</strong><span>${es?'Elige cuántos viajan':'اختر عدد الركاب'}</span></button></div></section><section class="account-strip">${uiIcon('person')}<div><strong>${account?uiSafe(account.nombre):(es?'Todo listo para viajar':'استعد لرحلتك')}</strong><p>${account?(es?'Tu cuenta de Taxily':'حسابك في Taxily'):(es?'Entra o crea tu cuenta.':'سجّل الدخول أو أنشئ حسابك.')}</p></div><button class="text-button" onclick="${account?'showMyProfile()':"accountMode='login';render()"}">${account?(es?'Ver perfil':'الملف'):(es?'Entrar':'دخول')} ${uiIcon('arrow')}</button></section><nav class="home-links" aria-label="${es?'Más opciones':'خيارات أخرى'}"><button onclick="selectRole('h')">${uiIcon('clock')}<span>${x.history}</span>${uiIcon('arrow')}</button><button onclick="selectRole('d')">${uiIcon('car')}<span>${es?'Zona de conductor':'منطقة السائق'}</span>${uiIcon('arrow')}</button><button onclick="enableNotifications()">${uiIcon('bell')}<span>${es?'Activar notificaciones':'تفعيل الإشعارات'}</span>${uiIcon('arrow')}</button>${account?`<button onclick="logout()">${uiIcon('person')}<span>${es?'Cerrar sesión':'تسجيل الخروج'}</span>${uiIcon('arrow')}</button>`:''}</nav>`}
function accountForm(){
  const register=accountMode==='register',es=lang==='es';
  const title=register?(es?'Crear cuenta':'إنشاء حساب'):(es?'Entrar':'تسجيل الدخول');
  return `<div class="card"><h2>${title}</h2>${bookingAccess?`<div class="notice">${es?'Para confirmar tu solicitud, entra en tu cuenta de pasajero o crea una. Hemos conservado los datos de tu viaje.':'لتأكيد طلب الرحلة، سجّل الدخول إلى حساب الراكب أو أنشئ حساباً. احتفظنا بتفاصيل رحلتك.'}</div>`:''}${register?`<label for="an">${es?'Nombre':'الاسم'}</label><input id="an" autocomplete="name"><label for="at">${es?'Tipo de cuenta':'نوع الحساب'}</label><select id="at" onchange="toggleCarFields()"><option value="pasajero">${es?'Pasajero':'راكب'}</option>${bookingAccess?'':`<option value="conductor" ${profileRole==='d'?'selected':''}>${es?'Conductor':'سائق'}</option>`}</select><div id="carFields"></div>`:''}<label for="ap">${es?'Teléfono':'الهاتف'}</label><input id="ap" type="tel" autocomplete="username"><label for="aw">${es?'Contraseña':'كلمة المرور'}</label><input id="aw" type="password" minlength="6" autocomplete="${register?'new-password':'current-password'}">${register?`<p>${es?'Usa al menos 6 caracteres.':'استخدم 6 أحرف على الأقل.'}</p>`:''}<button class="primary" onclick="submitAccount()">${title}</button><button class="secondary" style="width:100%;margin-top:12px" onclick="accountMode='${register?'login':'register'}';render()">${register?(es?'Ya tengo cuenta':'لدي حساب بالفعل'):(es?'Crear una cuenta':'إنشاء حساب')}</button><button class="secondary" style="width:100%;margin-top:12px" onclick="cancelAccountForm()">${es?'Volver':'رجوع'}</button></div>`;
}
function toggleCarFields(){const box=document.querySelector('#carFields');if(box)box.innerHTML=document.querySelector('#at').value==='conductor'?`<input id="av" placeholder="Vehículo"><input id="am" placeholder="Matrícula">`:'';}
async function submitAccount(){const body={telefono:document.querySelector('#ap').value.trim(),password:document.querySelector('#aw').value};if(accountMode==='register'){body.nombre=document.querySelector('#an').value.trim();body.tipo=document.querySelector('#at').value;body.vehiculo=document.querySelector('#av')?.value.trim();body.matricula=document.querySelector('#am')?.value.trim();}try{const r=await fetch('/api/cuentas/'+(accountMode==='register'?'registro':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!d.ok){alert(d.message);return;}saveAccount(d.perfil);if(bookingAccess&&account.tipo!=='pasajero'){alert(lang==='es'?'Entra con una cuenta de pasajero o crea una para pedir este viaje.':'سجّل الدخول بحساب راكب أو أنشئ حساباً لطلب هذه الرحلة.');return;}const resumeBooking=bookingAccess;accountMode=null;bookingAccess=false;role=resumeBooking?'p':account.tipo==='conductor'?'d':'p';render();}catch(error){alert('No se pudo conectar con el servidor.');}}
async function showMyProfile(){if(!account)return;role='account';render();const box=document.querySelector('#accountStats');try{const r=await fetch('/api/perfiles/'+account.id+'/resumen');const s=await r.json();box.innerHTML=`<div class="notice">🚕 Viajes: <b>${s.viajes}</b><br>⭐ Valoración: <b>${s.valoraciones? s.media.toFixed(1)+' / 5 ('+s.valoraciones+')':'Aún sin valoraciones'}</b>${account.tipo==='conductor'?`<br>💰 Ingresos acumulados: <b>${s.ingresos} DA</b>`:''}</div>`;}catch(error){box.textContent='No se pudo cargar el perfil.';}}
function profileForm(x){const conductor=profileRole==='d';return `<div class="card"><h3>👤 ${lang==='es'?'Tu perfil':'ملفك الشخصي'}</h3><label>${lang==='es'?'Nombre':'الاسم'}</label><input id="profileName" placeholder="${lang==='es'?'Tu nombre':'اسمك'}"><label>${lang==='es'?'Teléfono':'الهاتف'}</label><input id="profilePhone" type="tel" placeholder="+34 ...">${conductor?`<label>${lang==='es'?'Vehículo':'السيارة'}</label><input id="profileVehicle" placeholder="Toyota Land Cruiser"><label>${lang==='es'?'Matrícula':'رقم اللوحة'}</label><input id="profilePlate" placeholder="1234 ABC">`:''}<button class="primary" onclick="saveProfile()">${lang==='es'?'Guardar y continuar':'حفظ ومتابعة'}</button><button class="secondary" style="width:100%;margin-top:12px" onclick="role=null;render()">${x.back}</button></div>`}
function saveProfile(){const nombre=document.querySelector('#profileName').value.trim();const telefono=document.querySelector('#profilePhone').value.trim();if(!nombre||!telefono){alert(lang==='es'?'Escribe tu nombre y teléfono.':'أدخل الاسم والهاتف.');return;}const perfil={nombre,telefono};if(profileRole==='d'){perfil.vehiculo=document.querySelector('#profileVehicle').value.trim()||'Vehículo';perfil.matricula=document.querySelector('#profilePlate').value.trim()||'—';}localStorage.setItem('saharago_'+profileRole,JSON.stringify(perfil));role=profileRole;render();}
function history(x){return `<div class="card"><h3>📋 ${x.history}</h3><div id="historyContent" class="notice">${lang==='es'?'Cargando viajes...':'جاري تحميل الرحلات...'}</div><button class="secondary" style="width:100%" onclick="role=null;render()">${x.back}</button></div>`}
async function loadHistory(){
  const content=document.querySelector('#historyContent');
  try{
    const respuesta=await fetch('/api/viajes');
    const viajes=await respuesta.json();
    const propios=account?viajes.filter(v=>v.pasajeroId===account.id||v.conductorId===account.id):viajes;
    if(!propios.length){content.textContent=lang==='es'?'Todavía no hay viajes guardados.':'لا توجد رحلات محفوظة بعد.';return;}
    content.innerHTML=propios.slice().reverse().map(v=>`<div class="notice"><b>${v.origen} → ${v.destino}</b><br>${scheduleText(v)}<br>👥 ${passengerText(v)}<br>💰 ${priceText(v)} · ${v.estado}<br>🕒 ${v.creadoEn?new Date(v.creadoEn).toLocaleString():''}</div>`).join('');
  }catch(error){content.textContent=lang==='es'?'No se pudo cargar el historial.':'تعذر تحميل السجل.';}
}
function priceText(viaje){return viaje.precioPendiente||!Number.isFinite(viaje.precio)?(lang==='es'?'Precio pendiente de confirmar':'السعر في انتظار التأكيد'):viaje.precio+' DA';}
function passengerText(viaje){return viaje.modoViaje==='completo'?(lang==='es'?'Coche completo':'السيارة كاملة'):(viaje.pasajeros||1)+' '+(lang==='es'?'pasajero(s)':'راكب');}
function scheduleText(viaje){return viaje?.tipoReserva==='programada'&&viaje.fechaHora?`🗓️ ${new Date(viaje.fechaHora).toLocaleString()}`:(lang==='es'?'⏱️ Ahora':'⏱️ الآن');}
function booking(x){const es=lang==='es';return `<div class="booking-page"><button class="back-button" onclick="goHome()">${uiIcon('back')} ${es?'Inicio':'الرئيسية'}</button><div class="page-heading"><span class="eyebrow">${es?'TU PRÓXIMO VIAJE':'رحلتك القادمة'}</span><h1>${es?'Prepara tu viaje':'خطط لرحلتك'}</h1></div><section class="route-card"><div class="route-stop"><span class="route-dot"></span><div><label for="o" class="field-caption">${es?'RECOGIDA':'الانطلاق'}</label>${pickupMode==='gps'?`<strong>${es?'Tu ubicación actual':'موقعك الحالي'}</strong>`:`<select id="o"><option value="">${es?'¿Dónde te recogemos?':'أين نلتقي بك؟'}</option>${camps.map((c,i)=>`<option value="${i}">${c}</option>`).join('')}</select>`}<p id="pickupStatus" role="status">${pickupMode==='gps'?(es?'Usaremos tu GPS al confirmar.':'سنستخدم GPS عند التأكيد.'):(es?'Acuerda el punto exacto por teléfono.':'اتفق على الموقع الدقيق بالهاتف.')}</p><button class="pickup-toggle" onclick="changePickupMode()">${pickupMode==='gps'?(es?'Elegir campamento o Tindouf':'اختر مخيماً أو تندوف'):(es?'Usar mi ubicación GPS':'استخدم موقعي عبر GPS')}</button></div>${uiIcon('pin')}</div><div class="route-stop destination-stop"><span class="route-square"></span><div><label for="d" class="field-caption">${es?'DESTINO':'الوجهة'}</label><select id="d"><option value="">${es?'¿A qué campamento vas?':'إلى أي مخيم تذهب؟'}</option>${camps.map((c,i)=>`<option value="${i}">${c}</option>`).join('')}</select></div></div></section><p class="route-note">${es?'Elige un campamento o Tindouf. El punto de llegada lo acuerdas con el conductor.':'اختر مخيماً أو تندوف. اتفق مع السائق على نقطة الوصول.'}</p><section class="booking-section"><h2>${es?'¿Cuándo?':'متى؟'}</h2><div class="choice time-choice"><button class="${timing==='now'?'active':''}" aria-pressed="${timing==='now'}" onclick="rememberBooking();timing='now';render()">${uiIcon('arrow')} ${x.now}</button><button class="${timing==='later'?'active':''}" aria-pressed="${timing==='later'}" onclick="rememberBooking();timing='later';render()">${uiIcon('clock')} ${x.later}</button></div>${timing==='later'?`<div class="date-grid"><div><label for="date">${x.date}</label><input id="date" type="date"></div><div><label for="time">${x.time}</label><input id="time" type="time"></div></div><p class="route-note">${pickupMode==='gps'?(es?'La recogida será en tu ubicación GPS al hacer la reserva.':'الانطلاق من موقعك عبر GPS عند إجراء الحجز.'):(es?'Te recogerán en el lugar que has elegido.':'الانطلاق من المكان الذي اخترته.')}</p>`:''}</section><section class="booking-section"><h2>${es?'¿Cómo viajas?':'كيف تسافر؟'}</h2><div class="choice ride-choice"><button class="${rideMode==='completo'?'active':''}" aria-pressed="${rideMode==='completo'}" onclick="rememberBooking();rideMode='completo';render()">${uiIcon('car')}<strong>${es?'Coche completo':'السيارة كاملة'}</strong><span>${es?'Un coche para ti':'سيارة لك'}</span></button><button class="${rideMode==='pasajeros'?'active':''}" aria-pressed="${rideMode==='pasajeros'}" onclick="rememberBooking();rideMode='pasajeros';render()">${uiIcon('person')}<strong>${es?'Por pasajeros':'حسب عدد الركاب'}</strong><span>${es?'Elige cuántos viajan':'اختر عدد الركاب'}</span></button></div>${rideMode==='pasajeros'?`<div class="passenger-row"><label for="pax">${es?'Número de pasajeros':'عدد الركاب'}</label><input id="pax" type="number" min="1" value="1"></div>`:''}</section><div class="booking-footer"><div class="fare-row"><div><strong>${priceText({precioPendiente:true})}</strong><span>${es?'Pago en efectivo':'الدفع نقداً'}</span></div>${uiIcon('car')}</div><button class="primary" id="requestTrip" onclick="trip()">${x.request} ${uiIcon('arrow')}</button><p class="footer-note">${es?'Necesitas una cuenta de pasajero para solicitar el viaje.':'يلزم حساب راكب لطلب الرحلة.'}</p></div></div>`}
function changePickupMode(){rememberBooking();pickupMode=pickupMode==='gps'?'campamento':'gps';render();}
async function trip(){
  if(submittingTrip)return;
  rememberBooking();
  if(!account?.id){requireBookingAccount();return;}
  if(account.tipo!=='pasajero'){requireBookingAccount();return;}
  submittingTrip=true;
  const button=document.querySelector('#requestTrip');if(button)button.disabled=true;
  try{await sendTrip();}finally{submittingTrip=false;if(button)button.disabled=false;}
}
async function sendTrip(){
  const requestedMode=rideMode;const requestedTiming=timing;const requestedPickup=pickupMode;
  o=requestedPickup==='gps'?(lang==='es'?'Mi ubicación GPS':'موقعي عبر GPS'):camps[document.querySelector('#o').value];
  d=camps[document.querySelector('#d').value];

  const pasajeros = requestedMode==='completo'?null:document.querySelector('#pax').value;
  let fechaHora=null;
  if(requestedTiming==='later'){
    const fecha=document.querySelector('#date').value;
    const hora=document.querySelector('#time').value;
    if(!fecha||!hora){alert(lang==='es'?'Elige fecha y hora para la reserva.':'اختر تاريخ ووقت الحجز.');return;}
    fechaHora=`${fecha}T${hora}`;
  }
  if(!o){alert(lang==='es'?'Elige dónde te recogemos.':'اختر مكان الانطلاق.');return;}
  if(!d){alert(lang==='es'?'Elige un campamento o Tindouf como destino.':'اختر مخيماً أو تندوف كوجهة.');return;}
  if(requestedMode==='pasajeros'&&(!Number.isSafeInteger(Number(pasajeros))||Number(pasajeros)<1)){alert(lang==='es'?'Indica un número válido de pasajeros.':'أدخل عدداً صحيحاً من الركاب.');return;}
  const pickupStatus=document.querySelector('#pickupStatus');
  if(pickupStatus&&requestedPickup==='gps')pickupStatus.textContent=lang==='es'?'Obteniendo tu ubicación GPS…':'جارٍ تحديد موقعك عبر GPS…';
  const ubicacion = requestedPickup==='gps'?await captureLocation(0):null;
  if(requestedPickup==='gps'&&!ubicacion){
    const message=lang==='es'?'No se pudo obtener tu ubicación. Activa el GPS y permite la ubicación en el navegador. Después, vuelve a solicitar el viaje.':'تعذر تحديد موقعك. فعّل GPS واسمح للمتصفح بالوصول إلى موقعك، ثم أعد طلب الرحلة.';
    if(pickupStatus)pickupStatus.textContent=message;
    alert(message);return;
  }
  if(pickupStatus)pickupStatus.textContent=lang==='es'?'Enviando solicitud…':'جارٍ إرسال الطلب…';

  try {
    const respuesta = await fetch('/api/viajes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        origen: o,
        tipoRecogida:requestedPickup,
        destino: d,
        pasajeros: requestedMode==='completo'?null:Number(pasajeros),
        modoViaje:requestedMode,
        ubicacion,
        pasajero: account,
        pasajeroId: account?.tipo==='pasajero'?account.id:null,
        tipoReserva: requestedTiming==='later'?'programada':'ahora',
        fechaHora
      })
    });

    const datos = await respuesta.json();

    if(respuesta.status===401||respuesta.status===403){account=null;localStorage.removeItem('saharago_session');requireBookingAccount();return;}
    if(!datos.ok){
      alert(datos.message || 'Error al solicitar el viaje');
      return;
    }

    bookingDraft=null;bookingAccess=false;
    currentTripId=datos.viaje.id;
    currentPrice=datos.viaje.precio;
    lastTripStatus='solicitado';
    passengerConfirmed=false;
    showWaiting(datos.viaje);
    clearInterval(pollTimer);
    pollTimer=setInterval(checkTripStatus,2000);

  } catch(error) {
    console.error(error);
    alert(lang==='es'
      ? 'No se pudo conectar con el servidor.'
      : 'تعذر الاتصال بالخادم.');
  }
}
function showWaiting(viaje){
  let x=t();
  document.querySelector('#screen').innerHTML=`
    <div class="card center">
      <div class="big">🚗</div>
      <h2>${x.search}</h2>
      <p>${o} → ${d}</p>
      <p>${scheduleText(viaje)}</p><p>👥 ${passengerText(viaje)}</p>
      <p>💰 ${priceText(viaje)}</p>
      <p>⏳ ${lang==='es'?'Esperando a que un conductor acepte tu viaje...':'بانتظار قبول السائق لرحلتك...'}</p>
      <button class="secondary" onclick="cancelTrip()">${lang==='es'?'Cancelar viaje':'إلغاء الرحلة'}</button>
    </div>`;
}
async function checkTripStatus(){
  if(!currentTripId) return;
  try{
    const respuesta=await fetch('/api/viajes');
    const viajes=await respuesta.json();
    const viaje=viajes.find(v=>v.id===currentTripId);
    if(viaje){
      if(viaje.estado!==lastTripStatus){
        lastTripStatus=viaje.estado;
        const mensajes={aceptado:'✅ Tu conductor aceptó el viaje.',conductor_llegado:'📍 Tu conductor ha llegado.',en_curso:'🚕 Tu viaje ha comenzado.',finalizado:'🎉 Tu viaje ha finalizado.',cancelado:'❌ El viaje fue cancelado.'};
        if(mensajes[viaje.estado]) showNotice(lang==='es'?mensajes[viaje.estado]:mensajes[viaje.estado]);
        updatePassengerTrip(viaje);
      }else{
        refreshDriverMarker(viaje.ubicacionConductor);
      }
    }
  }catch(error){
    console.error(error);
  }
}
function updatePassengerTrip(viaje){
  if(viaje.estado==='aceptado'){
    found(viaje);
    return;
  }
  const estados={
    conductor_llegado:{icon:'📍',es:'¡Tu conductor ha llegado!',ar:'وصل السائق!'},
    en_curso:{icon:'🚕',es:'Tu viaje está en curso',ar:'رحلتك جارية'},
    finalizado:{icon:'🎉',es:'¡Viaje finalizado!',ar:'انتهت الرحلة!'},
    cancelado:{icon:'❌',es:'Viaje cancelado',ar:'تم إلغاء الرحلة'}
  };
  const estado=estados[viaje.estado];
  if(!estado) return;
  if(viaje.estado==='finalizado'||viaje.estado==='cancelado') clearInterval(pollTimer);
  document.querySelector('#screen').innerHTML=`<div class="card center"><div class="big">${estado.icon}</div><h2>${lang==='es'?estado.es:estado.ar}</h2><p>${viaje.origen} → ${viaje.destino}</p>${viaje.estado==='cancelado'?`<p>${lang==='es'?'Motivo: ':'السبب: '}${viaje.motivoCancelacion||''}</p>`:''}${viaje.estado==='finalizado'?ratingForm(viaje,'pasajero'):''}${contactSlot(viaje,'pasajero')}${viaje.estado==='conductor_llegado'?`<button class="secondary" onclick="cancelTrip()">${lang==='es'?'Cancelar viaje':'إلغاء الرحلة'}</button>`:''}<button class="primary" onclick="render()">${t().back}</button></div>`;
  loadTripContact(viaje,'pasajero');
}
function locationText(ubicacion){
  return ubicacion ? `${ubicacion.lat.toFixed(5)}, ${ubicacion.lng.toFixed(5)}` : (lang==='es'?'Ubicación no disponible':'الموقع غير متاح');
}
async function showReputation(elementId,tipo,nombre){
  const elemento=document.querySelector('#'+elementId);
  if(!elemento||!nombre)return;
  try{
    const respuesta=await fetch('/api/reputacion?tipo='+encodeURIComponent(tipo)+'&nombre='+encodeURIComponent(nombre));
    const datos=await respuesta.json();
    elemento.textContent=datos.total?`⭐ ${datos.media.toFixed(1)} · ${datos.total} ${lang==='es'?'valoración(es)':'تقييم'}`:(lang==='es'?'⭐ Nuevo usuario':'⭐ مستخدم جديد');
  }catch(error){elemento.textContent='⭐ —';}
}
function ratingForm(viaje,actor){
  const existente=actor==='pasajero'?viaje.valoracionConductor:viaje.valoracionPasajero;
  if(existente) return `<div class="notice">⭐ ${existente.estrellas}/5${existente.comentario?`<br>${existente.comentario}`:''}</div>`;
  const persona=actor==='pasajero'?(lang==='es'?'Valora al conductor':'قيّم السائق'):(lang==='es'?'Valora al pasajero':'قيّم الراكب');
  return `<div class="notice"><b>⭐ ${persona}</b><br><select id="rating-${actor}"><option value="5">5 ⭐</option><option value="4">4 ⭐</option><option value="3">3 ⭐</option><option value="2">2 ⭐</option><option value="1">1 ⭐</option></select><input id="comment-${actor}" placeholder="${lang==='es'?'Comentario opcional':'تعليق اختياري'}"><button class="primary" onclick="rateTrip('${viaje.id}','${actor}')">${lang==='es'?'Enviar valoración':'إرسال التقييم'}</button></div>`;
}
async function rateTrip(id,actor){
  try{
    const estrellas=Number(document.querySelector('#rating-'+actor).value);
    const comentario=document.querySelector('#comment-'+actor).value.trim();
    const respuesta=await fetch('/api/viajes/'+id+'/valoracion',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({actor,estrellas,comentario})});
    const datos=await respuesta.json();
    if(!datos.ok){alert(lang==='es'?'No se pudo guardar la valoración. Reinicia el servidor y vuelve a intentarlo.':'تعذر حفظ التقييم. أعد تشغيل الخادم وحاول مجدداً.');return;}
    if(actor==='pasajero') updatePassengerTrip(datos.viaje); else showDriverTrip(datos.viaje);
  }catch(error){alert(lang==='es'?'No se pudo conectar con el servidor.':'تعذر الاتصال بالخادم.');}
}
function contactSlot(viaje,actor){return ['aceptado','conductor_llegado','en_curso'].includes(viaje.estado)?'<div class="trip-contact" id="contact-'+actor+'" aria-live="polite"></div>':'';}
async function loadTripContact(viaje,actor){
 const box=document.querySelector('#contact-'+actor);if(!box)return;
 const label=actor==='pasajero'?(lang==='es'?'Llamar al conductor':'اتصل بالسائق'):(lang==='es'?'Llamar al pasajero':'اتصل بالراكب');
 box.textContent=lang==='es'?'Cargando teléfono…':'جارٍ تحميل الهاتف…';
 try{
  const response=await fetch('/api/viajes/'+encodeURIComponent(viaje.id)+'/contacto');const result=await response.json();
  if(!box.isConnected)return;
  if(!response.ok||!/^\+?\d{6,15}$/.test(result.telefono||''))throw Error();
  const link=document.createElement('a');link.className='primary call-button';link.href='tel:'+result.telefono;link.textContent=label;
  const note=document.createElement('p');note.className='route-note';note.textContent=lang==='es'?'Se abrirá el marcador con su número.':'سيُفتح تطبيق الهاتف مع الرقم.';
  box.replaceChildren(link,note);
 }catch{
  if(!box.isConnected)return;box.textContent=lang==='es'?'Teléfono no disponible.':'الهاتف غير متاح.';
  const retry=document.createElement('button');retry.className='secondary';retry.textContent=lang==='es'?'Reintentar':'أعد المحاولة';retry.onclick=()=>loadTripContact(viaje,actor);box.append(retry);
 }
}
function found(viaje){let x=t();const ubicacion=viaje?.ubicacionConductor;const conductor=viaje?.conductor||{nombre:'Conductor',vehiculo:'Vehículo'};const titulo=passengerConfirmed?(lang==='es'?'¡Viaje confirmado!':'تم تأكيد الرحلة!'):`✅ ${x.found}`;const texto=passengerConfirmed?(lang==='es'?'La ubicación del conductor se actualiza en tiempo real.':'يتم تحديث موقع السائق مباشرةً.'):(lang==='es'?'El conductor ha aceptado tu solicitud.':'قبل السائق طلبك.');document.querySelector('#screen').innerHTML=`<div class="card"><h2>${titulo}</h2><div class="driver">👨🏽 <b>${conductor.nombre}</b><br>🚙 ${conductor.vehiculo}${conductor.matricula?' · '+conductor.matricula:''}<br><span id="driverReputation">⭐</span></div><p>📍 ${o} → ${d}</p><p>🛰️ ${lang==='es'?'Ubicación GPS del conductor':'موقع السائق'}: <b>${locationText(ubicacion)}</b></p><div id="tripMap" class="trip-map"></div><p>💰 <b>${priceText(viaje)}</b> · 💵 ${lang==='es'?'Efectivo':'نقداً'}</p><p>${texto}</p>${contactSlot(viaje,'pasajero')}${passengerConfirmed?'':`<button class="primary" onclick="confirmTrip()">${x.confirm}</button>`}<button class="secondary" style="width:100%;margin-top:12px" onclick="cancelTrip()">${lang==='es'?'Cancelar viaje':'إلغاء الرحلة'}</button></div>`;loadTripContact(viaje,'pasajero');setTimeout(()=>{showTripMap(viaje);showReputation('driverReputation','conductor',conductor.nombre);},0)}
async function cancelTrip(){
  const motivo=lang==='es'?'Cancelado por el pasajero':'ألغاه الراكب';
  try{
    const respuesta=await fetch('/api/viajes/'+currentTripId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado:'cancelado',motivoCancelacion:motivo})});
    const datos=await respuesta.json();
    if(datos.ok){lastTripStatus='cancelado';updatePassengerTrip(datos.viaje);}
    else alert(lang==='es'?'No se pudo cancelar. Reinicia el servidor y vuelve a probar.':'تعذر الإلغاء. أعد تشغيل الخادم وحاول مرة أخرى.');
  }catch(error){
    alert(lang==='es'?'No se pudo conectar con el servidor.':'تعذر الاتصال بالخادم.');
  }
}
function showTripMap(viaje){
  const mapElement=document.querySelector('#tripMap');
  if(!mapElement || !window.L) return;
  const puntos=[];
  tripMap=L.map(mapElement,{zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(tripMap);
  if(viaje.ubicacionPasajero){
    const p=[viaje.ubicacionPasajero.lat,viaje.ubicacionPasajero.lng];
    L.marker(p).addTo(tripMap).bindPopup(lang==='es'?'Pasajero':'الراكب');
    puntos.push(p);
  }
  if(viaje.ubicacionConductor){
    const p=[viaje.ubicacionConductor.lat,viaje.ubicacionConductor.lng];
    driverMarker=L.marker(p).addTo(tripMap).bindPopup(lang==='es'?'Conductor':'السائق');
    puntos.push(p);
  }
  if(puntos.length===2) tripMap.fitBounds(puntos,{padding:[30,30]});
  else if(puntos.length===1) tripMap.setView(puntos[0],15);
  else { tripMap.setView([26.1,-9.0],5); }
}
function refreshDriverMarker(ubicacion){
  if(!ubicacion || !tripMap) return;
  const punto=[ubicacion.lat,ubicacion.lng];
  if(driverMarker) driverMarker.setLatLng(punto);
  else driverMarker=L.marker(punto).addTo(tripMap).bindPopup(lang==='es'?'Conductor':'السائق');
}
async function confirmTrip(){
  passengerConfirmed=true;
  const respuesta=await fetch('/api/viajes');
  const viajes=await respuesta.json();
  const viaje=viajes.find(v=>v.id===currentTripId);
  if(viaje) found(viaje);
}
function driver(x){
  return `
    <div class="card">
      <h3>🚗 ${x.driver}</h3>
      <p>${x.loc}</p>
      <button class="primary" onclick="driverAvailable()">
        ${lang==='es'?'Estoy disponible':'أنا متاح'}
      </button>
      <div id="driverStatus"></div>
    </div>
  `;
}

  async function driverAvailable(){
  const status=document.querySelector('#driverStatus');

  try {
    driverLocation=await captureLocation();
    const respuesta=await fetch('/api/viajes');
    const viajes=await respuesta.json();

    const perfilConductor=getProfile('d');
    const pendientes=viajes.filter(v=>v.estado==='solicitado');
    const porValorar=viajes.filter(v=>v.estado==='finalizado'&&(v.conductorId===perfilConductor?.id||v.conductor?.nombre===perfilConductor?.nombre)&&!v.valoracionPasajero);
    const asignados=viajes.filter(v=>(v.conductorId===perfilConductor?.id||v.conductor?.nombre===perfilConductor?.nombre)&&['aceptado','conductor_llegado','en_curso'].includes(v.estado));
    knownPendingTrips=new Set(pendientes.map(v=>v.id));
    if(!driverNoticeTimer) driverNoticeTimer=setInterval(checkDriverNotifications,4000);

    if(pendientes.length===0&&porValorar.length===0&&asignados.length===0){
      status.innerHTML=`
        <div class="notice">
          📭 ${lang==='es'
            ? 'No hay viajes pendientes en este momento.'
            : 'لا توجد رحلات معلقة حالياً.'}
        </div>
      `;
      return;
    }

    status.innerHTML=`
      <div class="card">
        <h3>📋 ${lang==='es'?'Viajes disponibles':'الرحلات المتاحة'}</h3>

        ${pendientes.map(v=>`
          <div class="notice">
            <b>📍 ${v.origen}</b><br>
            ➡️ ${v.destino}<br>
            👥 ${passengerText(v)}<br>
            👤 ${v.pasajero?.nombre|| (lang==='es'?'Pasajero':'راكب')} · <span id="passengerReputation-${v.id}">⭐</span><br>
            ${scheduleText(v)}<br>
            💰 ${priceText(v)}<br><br>

            <button class="primary" onclick="aceptarViaje('${v.id}')">
              ${lang==='es'?'Aceptar viaje':'قبول الرحلة'}
            </button>
          </div>
        `).join('')}
        ${asignados.length?`<h3>✅ ${lang==='es'?'Mis reservas aceptadas':'حجوزاتي المقبولة'}</h3>${asignados.map(v=>`<div class="notice"><b>${v.origen} → ${v.destino}</b><br>${scheduleText(v)}<br>💰 ${priceText(v)}<br><button class="primary" onclick="openDriverRating('${v.id}')">${lang==='es'?'Ver viaje':'عرض الرحلة'}</button></div>`).join('')}`:''}
        ${porValorar.length?`<h3>⭐ ${lang==='es'?'Valoraciones pendientes':'تقييمات معلقة'}</h3>${porValorar.map(v=>`<div class="notice"><b>${v.origen} → ${v.destino}</b><br><button class="primary" onclick="openDriverRating('${v.id}')">${lang==='es'?'Valorar pasajero':'تقييم الراكب'}</button></div>`).join('')}`:''}
      </div>
    `;
    pendientes.forEach(v=>showReputation('passengerReputation-'+v.id,'pasajero',v.pasajero?.nombre));

  } catch(error) {
    console.error(error);

    status.innerHTML=`
      <div class="notice">
        ❌ ${lang==='es'
          ? 'No se pudo conectar con el servidor.'
          : 'تعذر الاتصال بالخادم.'}
      </div>
    `;
  }
}
async function checkDriverNotifications(){
  if(role!=='d') return;
  try{
    const respuesta=await fetch('/api/viajes');
    const viajes=await respuesta.json();
    const nuevos=viajes.filter(v=>v.estado==='solicitado'&&!knownPendingTrips.has(v.id));
    nuevos.forEach(v=>knownPendingTrips.add(v.id));
    if(nuevos.length) showNotice(`🚗 ${lang==='es'?'Tienes un nuevo viaje disponible.':'لديك رحلة جديدة متاحة.'}`);
    const perfil=getProfile('d');
    viajes.filter(v=>(v.conductorId===perfil?.id||v.conductor?.nombre===perfil?.nombre)&&v.tipoReserva==='programada'&&v.estado==='aceptado'&&v.fechaHora).forEach(v=>{
      const horas=(new Date(v.fechaHora).getTime()-Date.now())/3600000;
      [3,1].forEach(h=>{
        const clave=v.id+'-'+h;
        if(horas<=h&&horas>h-(10/60)&&!reminderSeen.has(clave)){
          reminderSeen.add(clave);
          showNotice(`⏰ ${lang==='es'?`Recordatorio: tienes una reserva dentro de ${h} hora${h>1?'s':''}.`:`تذكير: لديك حجز بعد ${h} ساعة.`}`);
        }
      });
    });
  }catch(error){console.error(error);}
}
async function openDriverRating(id){
  const respuesta=await fetch('/api/viajes');
  const viajes=await respuesta.json();
  const viaje=viajes.find(v=>v.id===id);
  if(viaje) showDriverTrip(viaje);
}
async function aceptarViaje(id){
  updateDriverTrip(id,'aceptado',driverLocation,getProfile('d'));
}
async function updateDriverTrip(id,estado,ubicacionConductor=null,conductor=null,pagoEstado=null){
  try {
    const respuesta = await fetch('/api/viajes/' + id, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({estado, conductorUbicacion: ubicacionConductor, conductor, conductorId:account?.tipo==='conductor'?account.id:null, pagoEstado})
    });
    const datos = await respuesta.json();
    if(respuesta.status===401){accountMode='login';bookingAccess=false;render();return;}
    if(!datos.ok){ alert(datos.message || 'No se pudo actualizar el viaje.'); return; }
    showDriverTrip(datos.viaje);
  } catch(error) {
    console.error(error);
    alert('Error de conexión con el servidor.');
  }
}
function showDriverTrip(viaje){
  currentDriverTripId=viaje.id;
  if(['finalizado','cancelado'].includes(viaje.estado)) {
    stopLocationSharing();
    clearInterval(driverPollTimer);driverPollTimer=null;
  }
  else {startLocationSharing(viaje.id);if(!driverPollTimer)driverPollTimer=setInterval(checkDriverTrip,2000);}
  const siguiente={
    aceptado:{texto:'📍 He llegado al punto de recogida',estado:'conductor_llegado'},
    conductor_llegado:{texto:'▶️ Iniciar viaje',estado:'en_curso'},
    en_curso:{texto:'🏁 Finalizar viaje',estado:'finalizado'}
  }[viaje.estado];
  const titulo={aceptado:'¡Viaje aceptado!',conductor_llegado:'Has llegado al pasajero',en_curso:'Viaje en curso',finalizado:'¡Viaje finalizado!',cancelado:'Viaje cancelado'}[viaje.estado];
  document.querySelector('#driverStatus').innerHTML=`
    <div class="notice">
      ✅ <b>${titulo}</b><br><br>
      📍 ${viaje.origen} → ${viaje.destino}<br>
      ${scheduleText(viaje)}<br>
      👥 ${passengerText(viaje)}<br>
      🛰️ GPS pasajero: ${locationText(viaje.ubicacionPasajero)}<br>
      <div id="tripMap" class="trip-map"></div>
      💰 ${priceText(viaje)} · 💵 ${viaje.metodoPago||'Efectivo'} (${viaje.pagoEstado||'pendiente'})
      ${viaje.estado==='finalizado'&&!viaje.precioPendiente&&viaje.pagoEstado!=='pagado'?`<br><br><button class="primary" onclick="markPaid('${viaje.id}')">${lang==='es'?'Marcar como pagado':'تأكيد الدفع'}</button>`:''}
      ${viaje.estado==='finalizado'?ratingForm(viaje,'conductor'):''}
      ${contactSlot(viaje,'conductor')}
      ${siguiente?`<br><br><button class="primary" onclick="updateDriverTrip('${viaje.id}', '${siguiente.estado}')">${siguiente.texto}</button>`:''}
    </div>`;
  loadTripContact(viaje,'conductor');
  setTimeout(()=>showTripMap(viaje),0);
}
function markPaid(id){updateDriverTrip(id,'finalizado',null,null,'pagado');}
async function checkDriverTrip(){
  if(!currentDriverTripId) return;
  try{
    const respuesta=await fetch('/api/viajes');
    const viajes=await respuesta.json();
    const viaje=viajes.find(v=>v.id===currentDriverTripId);
    if(viaje&&viaje.estado==='cancelado'){
      clearInterval(driverPollTimer);driverPollTimer=null;stopLocationSharing();
      document.querySelector('#driverStatus').innerHTML=`<div class="notice">❌ <b>${lang==='es'?'El pasajero canceló el viaje.':'ألغى الراكب الرحلة.'}</b><br>${lang==='es'?'Motivo: ':'السبب: '}${viaje.motivoCancelacion||''}</div>`;
    }
  }catch(error){console.error(error);}
}
function startLocationSharing(viajeId){
  if(sharingTripId===viajeId || !navigator.geolocation) return;
  stopLocationSharing();
  sharingTripId=viajeId;
  locationWatcher=navigator.geolocation.watchPosition(
    posicion=>{
      const ubicacion={lat:posicion.coords.latitude,lng:posicion.coords.longitude};
      fetch('/api/viajes/'+viajeId+'/ubicacion-conductor',{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ubicacion})
      }).catch(error=>console.error(error));
    },
    error=>console.error(error),
    {enableHighAccuracy:true,maximumAge:3000,timeout:15000}
  );
}
function stopLocationSharing(){
  if(locationWatcher!==null) navigator.geolocation.clearWatch(locationWatcher);
  locationWatcher=null;
  sharingTripId=null;
}
function captureLocation(maximumAge=30000){
  return new Promise(resolve=>{
    if(!navigator.geolocation){ resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      posicion=>{const lat=posicion.coords.latitude,lng=posicion.coords.longitude;resolve(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null);},
      ()=>resolve(null),
      {enableHighAccuracy:true,timeout:15000,maximumAge}
    );
  });
}
async function loc(){
  const ubicacion=await captureLocation();
  alert(ubicacion ? (lang==='es'?'Ubicación GPS activada.':'تم تفعيل موقع GPS.') : (lang==='es'?'No se pudo obtener la ubicación.':'تعذر الحصول على الموقع.'));
}
document.querySelector('#lang').onclick=()=>{rememberBooking();lang=lang==='es'?'ar':'es';render()};render();
