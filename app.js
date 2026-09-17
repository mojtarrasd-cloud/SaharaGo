const camps=['Smara / السمارة','El Aaiún / العيون','Auserd / أوسرد','Dajla / الداخلة','Rabuni / الرابوني'];
const E={title:'Tu viaje, más cerca',sub:'Reserva viajes entre los campamentos.',loc:'Activa y permite la ubicación para usar SaharaGo.',origin:'Origen',dest:'Destino',when:'¿Cuándo quieres viajar?',now:'Ahora',later:'Reservar',date:'Fecha',time:'Hora',pass:'Pasajeros',request:'Solicitar viaje',role:'¿Cómo quieres usar SaharaGo?',passenger:'Pasajero',driver:'Conductor',history:'Historial de viajes',search:'Buscando conductor...',found:'¡Conductor encontrado!',confirm:'Confirmar viaje',back:'Volver'};
const A={title:'رحلتك أقرب إليك',sub:'احجز رحلات بين المخيمات.',loc:'فعّل الموقع واسمح للتطبيق باستخدامه.',origin:'نقطة الانطلاق',dest:'الوجهة',when:'متى تريد السفر؟',now:'الآن',later:'حجز',date:'التاريخ',time:'الوقت',pass:'عدد الركاب',request:'طلب الرحلة',role:'كيف تريد استخدام SaharaGo؟',passenger:'راكب',driver:'سائق',history:'سجل الرحلات',search:'جاري البحث عن سائق...',found:'تم العثور على سائق!',confirm:'تأكيد الرحلة',back:'رجوع'};
let lang='es',role=null,accountMode=null,account=loadAccount(),timing='now',o='',d='',currentTripId=null,pollTimer=null,lastTripStatus='',driverLocation=null,tripMap=null,driverMarker=null,locationWatcher=null,sharingTripId=null,passengerConfirmed=false,profileRole=null,driverPollTimer=null,currentDriverTripId=null,driverNoticeTimer=null,knownPendingTrips=new Set(),reminderSeen=new Set(),currentPrice=300;
const t=()=>lang==='es'?E:A;
function loadAccount(){try{return JSON.parse(localStorage.getItem('saharago_session'));}catch(error){return null;}}
function saveAccount(perfil){account=perfil;localStorage.setItem('saharago_session',JSON.stringify(perfil));}
function logout(){localStorage.removeItem('saharago_session');account=null;role=null;render();}
function selectRole(r){
  if(r==='h'){role='h';render();return;}
  profileRole=r;
  if(!getProfile(r)){role='profile';render();return;}
  role = r;
  render();
}
function getProfile(tipo){if(account&&account.tipo===tipo)return account;try{return JSON.parse(localStorage.getItem('saharago_'+tipo));}catch(error){return null;}}
function showNotice(message){const anterior=document.querySelector('.toast');if(anterior)anterior.remove();const aviso=document.createElement('div');aviso.className='toast';aviso.textContent=message;document.body.appendChild(aviso);setTimeout(()=>aviso.remove(),4000);if('Notification' in window&&Notification.permission==='granted')new Notification('SaharaGo',{body:message});}
async function enableNotifications(){if(!('Notification' in window)){alert('Las notificaciones no están disponibles.');return;}const permiso=await Notification.requestPermission();showNotice(permiso==='granted'?'🔔 Notificaciones activadas.':'Las notificaciones no fueron activadas.');}
function render(){let x=t();document.body.classList.toggle('rtl',lang==='ar');document.querySelector('#lang').textContent=lang==='es'?'العربية':'Español';document.querySelector('#screen').innerHTML=accountMode?accountForm():!role?home(x):role==='account'?`<div class="card"><h2>👤 Mi perfil</h2><p><b>${account.nombre}</b><br>${account.tipo==='conductor'?'🚗 Conductor':'👤 Pasajero'}${account.vehiculo?`<br>${account.vehiculo}${account.matricula?' · '+account.matricula:''}`:''}</p><div id="accountStats" class="notice">Cargando datos...</div><button class="secondary" onclick="role=null;render()">Volver</button></div>`:role==='profile'?profileForm(x):role==='p'?booking(x):role==='d'?driver(x):history(x);if(role==='h')loadHistory();}
function home(x){const access=account?`<div class="notice">👋 ${account.nombre}<br><button class="secondary" style="margin-top:8px" onclick="showMyProfile()">Mi perfil</button> <button class="secondary" style="margin-top:8px" onclick="logout()">Salir</button></div>`:`<button class="primary" onclick="accountMode='login';render()">Entrar</button><button class="secondary" style="width:100%;margin-top:12px" onclick="accountMode='register';render()">Crear cuenta</button>`;const action=account?(account.tipo==='conductor'?`<button class="primary" onclick="selectRole('d')">🚗 Abrir zona de conductor</button>`:`<button class="primary" onclick="selectRole('p')">👤 Pedir un viaje</button>`):`<div class="choice"><button onclick="selectRole('p')">👤 ${x.passenger}</button><button onclick="selectRole('d')">🚗 ${x.driver}</button></div>`;return `<h1>${x.title}</h1><p>${x.sub}</p>${access}<div class="notice">📍 ${x.loc}</div><button class="primary" onclick="loc()">📍 ${lang==='es'?'Activar ubicación':'تفعيل الموقع'}</button><button class="secondary" style="width:100%;margin-top:12px" onclick="enableNotifications()">🔔 ${lang==='es'?'Activar notificaciones':'تفعيل الإشعارات'}</button><div class="card"><h3>${x.role}</h3>${action}<button class="secondary" style="width:100%;margin-top:12px" onclick="selectRole('h')">📋 ${x.history}</button></div>`}
function accountForm(){const register=accountMode==='register';return `<div class="card"><h2>${register?'Crear cuenta':'Entrar'}</h2>${register?`<input id="an" placeholder="Nombre"><select id="at" onchange="toggleCarFields()"><option value="pasajero">Pasajero</option><option value="conductor">Conductor</option></select><div id="carFields"></div>`:''}<input id="ap" type="tel" placeholder="Teléfono"><input id="aw" type="password" minlength="6" placeholder="Contraseña (mínimo 6 caracteres)"><button class="primary" onclick="submitAccount()">${register?'Crear cuenta':'Entrar'}</button><button class="secondary" onclick="accountMode=null;render()">Volver</button></div>`}
function toggleCarFields(){const box=document.querySelector('#carFields');if(box)box.innerHTML=document.querySelector('#at').value==='conductor'?`<input id="av" placeholder="Vehículo"><input id="am" placeholder="Matrícula">`:'';}
async function submitAccount(){const body={telefono:document.querySelector('#ap').value.trim(),password:document.querySelector('#aw').value};if(accountMode==='register'){body.nombre=document.querySelector('#an').value.trim();body.tipo=document.querySelector('#at').value;body.vehiculo=document.querySelector('#av')?.value.trim();body.matricula=document.querySelector('#am')?.value.trim();}try{const r=await fetch('/api/cuentas/'+(accountMode==='register'?'registro':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!d.ok){alert(d.message);return;}saveAccount(d.perfil);accountMode=null;role=account.tipo==='conductor'?'d':'p';render();}catch(error){alert('No se pudo conectar con el servidor.');}}
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
    content.innerHTML=propios.slice().reverse().map(v=>`<div class="notice"><b>${v.origen} → ${v.destino}</b><br>${scheduleText(v)}<br>💰 ${v.precio||500} DA · ${v.estado}<br>🕒 ${v.creadoEn?new Date(v.creadoEn).toLocaleString():''}</div>`).join('');
  }catch(error){content.textContent=lang==='es'?'No se pudo cargar el historial.':'تعذر تحميل السجل.';}
}
function priceForIndices(origen,destino){return 300+(Math.abs(Number(origen)-Number(destino))*200);}
function updatePrice(){const precio=priceForIndices(document.querySelector('#o').value,document.querySelector('#d').value);document.querySelector('#tripPrice').textContent=precio+' DA';}
function scheduleText(viaje){return viaje?.tipoReserva==='programada'&&viaje.fechaHora?`🗓️ ${new Date(viaje.fechaHora).toLocaleString()}`:(lang==='es'?'⏱️ Ahora':'⏱️ الآن');}
function booking(x){return `<div class="card"><h3>🚕 ${x.passenger}</h3><label>${x.origin}</label><select id="o" onchange="updatePrice()">${camps.map((c,i)=>`<option value="${i}">${c}</option>`).join('')}</select><label>${x.dest}</label><select id="d" onchange="updatePrice()">${camps.map((c,i)=>`<option value="${i}">${c}</option>`).join('')}</select><label>${x.when}</label><div class="choice"><button class="${timing==='now'?'active':''}" onclick="timing='now';render()">${x.now}</button><button class="${timing==='later'?'active':''}" onclick="timing='later';render()">${x.later}</button></div>${timing==='later'?`<label>${x.date}</label><input id="date" type="date"><label>${x.time}</label><input id="time" type="time">`:''}<label>${x.pass}</label><input id="pax" type="number" min="1" value="1"><div class="notice">💰 Precio estimado: <b id="tripPrice">300 DA</b><br>💵 ${lang==='es'?'Pago: solo efectivo':'الدفع: نقداً فقط'}</div><button class="primary" onclick="trip()">${x.request}</button></div>`}
async function trip(){
  o=camps[document.querySelector('#o').value];
  d=camps[document.querySelector('#d').value];

  const pasajeros = document.querySelector('#pax').value || 1;
  let fechaHora=null;
  if(timing==='later'){
    const fecha=document.querySelector('#date').value;
    const hora=document.querySelector('#time').value;
    if(!fecha||!hora){alert(lang==='es'?'Elige fecha y hora para la reserva.':'اختر تاريخ ووقت الحجز.');return;}
    fechaHora=`${fecha}T${hora}`;
  }
  const ubicacion = await captureLocation();

  try {
    const respuesta = await fetch('/api/viajes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        origen: o,
        destino: d,
        pasajeros: Number(pasajeros),
        ubicacion,
        pasajero: getProfile('p'),
        pasajeroId: account?.tipo==='pasajero'?account.id:null,
        tipoReserva: timing==='later'?'programada':'ahora',
        fechaHora
      })
    });

    const datos = await respuesta.json();

    if(!datos.ok){
      alert('Error al solicitar el viaje');
      return;
    }

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
      <p>${scheduleText(viaje)}</p>
      <p>💰 ${currentPrice} DA</p>
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
  document.querySelector('#screen').innerHTML=`<div class="card center"><div class="big">${estado.icon}</div><h2>${lang==='es'?estado.es:estado.ar}</h2><p>${viaje.origen} → ${viaje.destino}</p>${viaje.estado==='cancelado'?`<p>${lang==='es'?'Motivo: ':'السبب: '}${viaje.motivoCancelacion||''}</p>`:''}${viaje.estado==='finalizado'?ratingForm(viaje,'pasajero'):''}${viaje.estado==='conductor_llegado'?`<button class="secondary" onclick="cancelTrip()">${lang==='es'?'Cancelar viaje':'إلغاء الرحلة'}</button>`:''}<button class="primary" onclick="render()">${t().back}</button></div>`;
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
function found(viaje){let x=t();const ubicacion=viaje?.ubicacionConductor;const conductor=viaje?.conductor||{nombre:'Conductor',vehiculo:'Vehículo'};const titulo=passengerConfirmed?(lang==='es'?'¡Viaje confirmado!':'تم تأكيد الرحلة!'):`✅ ${x.found}`;const texto=passengerConfirmed?(lang==='es'?'La ubicación del conductor se actualiza en tiempo real.':'يتم تحديث موقع السائق مباشرةً.'):(lang==='es'?'El conductor ha aceptado tu solicitud.':'قبل السائق طلبك.');document.querySelector('#screen').innerHTML=`<div class="card"><h2>${titulo}</h2><div class="driver">👨🏽 <b>${conductor.nombre}</b><br>🚙 ${conductor.vehiculo}${conductor.matricula?' · '+conductor.matricula:''}<br><span id="driverReputation">⭐</span></div><p>📍 ${o} → ${d}</p><p>🛰️ ${lang==='es'?'Ubicación GPS del conductor':'موقع السائق'}: <b>${locationText(ubicacion)}</b></p><div id="tripMap" class="trip-map"></div><p>💰 <b>${viaje.precio||currentPrice} DA</b> · 💵 ${lang==='es'?'Efectivo':'نقداً'}</p><p>${texto}</p>${passengerConfirmed?'':`<button class="primary" onclick="confirmTrip()">${x.confirm}</button>`}<button class="secondary" style="width:100%;margin-top:12px" onclick="cancelTrip()">${lang==='es'?'Cancelar viaje':'إلغاء الرحلة'}</button></div>`;setTimeout(()=>{showTripMap(viaje);showReputation('driverReputation','conductor',conductor.nombre);},0)}
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
            👥 ${v.pasajeros} ${lang==='es'?'pasajero(s)':'راكب'}<br>
            👤 ${v.pasajero?.nombre|| (lang==='es'?'Pasajero':'راكب')} · <span id="passengerReputation-${v.id}">⭐</span><br>
            ${scheduleText(v)}<br>
            💰 ${v.precio||500} DA<br><br>

            <button class="primary" onclick="aceptarViaje('${v.id}')">
              ${lang==='es'?'Aceptar viaje':'قبول الرحلة'}
            </button>
          </div>
        `).join('')}
        ${asignados.length?`<h3>✅ ${lang==='es'?'Mis reservas aceptadas':'حجوزاتي المقبولة'}</h3>${asignados.map(v=>`<div class="notice"><b>${v.origen} → ${v.destino}</b><br>${scheduleText(v)}<br>💰 ${v.precio||500} DA<br><button class="primary" onclick="openDriverRating('${v.id}')">${lang==='es'?'Ver viaje':'عرض الرحلة'}</button></div>`).join('')}`:''}
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
      👥 ${viaje.pasajeros} pasajero(s)<br>
      🛰️ GPS pasajero: ${locationText(viaje.ubicacionPasajero)}<br>
      <div id="tripMap" class="trip-map"></div>
      💰 ${viaje.precio||500} DA · 💵 ${viaje.metodoPago||'Efectivo'} (${viaje.pagoEstado||'pendiente'})
      ${viaje.estado==='finalizado'&&viaje.pagoEstado!=='pagado'?`<br><br><button class="primary" onclick="markPaid('${viaje.id}')">${lang==='es'?'Marcar como pagado':'تأكيد الدفع'}</button>`:''}
      ${viaje.estado==='finalizado'?ratingForm(viaje,'conductor'):''}
      ${siguiente?`<br><br><button class="primary" onclick="updateDriverTrip('${viaje.id}', '${siguiente.estado}')">${siguiente.texto}</button>`:''}
    </div>`;
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
function captureLocation(){
  return new Promise(resolve=>{
    if(!navigator.geolocation){ resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      posicion=>resolve({lat:posicion.coords.latitude,lng:posicion.coords.longitude}),
      ()=>resolve(null),
      {enableHighAccuracy:true,timeout:10000,maximumAge:30000}
    );
  });
}
async function loc(){
  const ubicacion=await captureLocation();
  alert(ubicacion ? (lang==='es'?'Ubicación GPS activada.':'تم تفعيل موقع GPS.') : (lang==='es'?'No se pudo obtener la ubicación.':'تعذر الحصول على الموقع.'));
}
document.querySelector('#lang').onclick=()=>{lang=lang==='es'?'ar':'es';render()};render();
