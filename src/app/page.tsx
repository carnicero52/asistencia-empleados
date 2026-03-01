'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Users, Clock, Settings, BarChart3, LogIn, LogOut, Sun, Moon,
  ChevronRight, Edit, Trash2, Download, QrCode, Plus, Search,
  AlertCircle, CheckCircle, XCircle, Building, Phone, Mail,
  Briefcase, Calendar, Timer, X, Save, RefreshCw, Camera, CameraOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Tipos
interface Empleado {
  id: string;
  codigo: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  cargo: string;
  departamento: string | null;
  turno: string;
  codigoQr: string;
  estado: string;
  horaEntrada: string;
  horaSalida: string;
  telegramChatId: string | null;
  recibirNotificaciones: boolean;
  createdAt: string;
  _count?: { asistencias: number };
}

interface Asistencia {
  id: string;
  empleadoId: string;
  tipo: string;
  fecha: string;
  hora: string;
  turno: string;
  estado: string;
  metodo: string;
  horasTrabajadas: number | null;
  empleado: Empleado;
}

interface Configuracion {
  id: string;
  nombreEmpresa: string;
  logo: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  colorPrimario: string;
  colorSecundario: string;
  telegramToken: string | null;
  telegramChatIdDueno: string | null;
  horaEntradaDiurno: string;
  horaSalidaDiurno: string;
  horaEntradaNocturno: string;
  horaSalidaNocturno: string;
  toleranciaMinutos: number;
  enviarReporteDiario: boolean;
  horaReporteDiario: string;
}

interface Resumen {
  totalEmpleados: number;
  presentes: number;
  ausentes: number;
  entradas: number;
  salidas: number;
  tardanzas: number;
}

export default function SistemaAsistenciaEmpleados() {
  // Estados principales
  const [modo, setModo] = useState<'seleccion' | 'admin' | 'recepcion'>('seleccion');
  const [darkMode, setDarkMode] = useState(false);
  const [seccionAdmin, setSeccionAdmin] = useState<'dashboard' | 'empleados' | 'asistencia' | 'reportes' | 'configuracion'>('dashboard');

  // Estados de autenticación
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [errorPassword, setErrorPassword] = useState('');

  // Estados de datos
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error' | 'info'; texto: string } | null>(null);
  const [modalEmpleado, setModalEmpleado] = useState(false);
  const [modalEditar, setModalEditar] = useState<Empleado | null>(null);
  const [modalQR, setModalQR] = useState<Empleado | null>(null);
  const [modalPin, setModalPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Estados de formularios
  const [formEmpleado, setFormEmpleado] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    cargo: '',
    departamento: '',
    turno: 'diurno',
    horaEntrada: '08:00',
    horaSalida: '17:00'
  });

  // Refs
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Aplicar modo oscuro
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (modo === 'admin' || modo === 'recepcion') {
      cargarDatos();
    }
  }, [modo]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [empRes, asisRes, confRes, resRes] = await Promise.all([
        fetch('/api/empleados'),
        fetch('/api/asistencia'),
        fetch('/api/configuracion'),
        fetch('/api/reportes?tipo=resumen')
      ]);

      if (empRes.ok) setEmpleados(await empRes.json());
      if (asisRes.ok) setAsistencias(await asisRes.json());
      if (confRes.ok) setConfiguracion(await confRes.json());
      if (resRes.ok) setResumen(await resRes.json());
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Escáner QR con Html5Qrcode directo
  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return;

    try {
      setCameraError(null);
      
      // Limpiar escáner anterior si existe
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
          html5QrCodeRef.current.clear();
        } catch (e) {
          console.log('Limpiando escáner anterior');
        }
      }

      html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText: string) => {
          try {
            const response = await fetch('/api/asistencia', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ codigoQr: decodedText })
            });

            const data = await response.json();

            if (response.ok && data.success) {
              const asistencia = data.asistencia;
              const tipoTexto = asistencia.tipo === 'entrada' ? '🟢 ENTRADA' : '🔴 SALIDA';
              const estadoTexto = asistencia.estado === 'tardanza' ? ' ⚠️ TARDANZA' : '';

              setMensaje({
                tipo: asistencia.estado === 'tardanza' ? 'error' : 'success',
                texto: `${tipoTexto} - ${data.empleado.nombre} ${data.empleado.apellido}${estadoTexto}\n${data.empleado.cargo} | ${data.empleado.turno.toUpperCase()}`
              });

              // Vibrar si es posible
              if (navigator.vibrate) {
                navigator.vibrate(asistencia.estado === 'tardanza' ? [200, 100, 200] : 200);
              }
            } else {
              setMensaje({ tipo: 'error', texto: data.error || 'Error al registrar asistencia' });
            }

            setTimeout(() => setMensaje(null), 5000);
          } catch (error) {
            console.error('Error:', error);
            setMensaje({ tipo: 'error', texto: 'Error de conexión' });
          }
        },
        () => {}
      );

      setCameraActive(true);
    } catch (err: unknown) {
      console.error('Error iniciando cámara:', err);
      setCameraActive(false);
      if (err instanceof Error) {
        setCameraError(err.message || 'No se pudo acceder a la cámara');
      } else {
        setCameraError('No se pudo acceder a la cámara');
      }
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.log('Error deteniendo escáner');
      }
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Iniciar/detener escáner cuando cambia el modo
  useEffect(() => {
    if (modo === 'recepcion') {
      // Pequeño delay para que el DOM esté listo
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [modo, startScanner, stopScanner]);

  // Funciones de empleados
  const crearEmpleado = async () => {
    if (!formEmpleado.nombre || !formEmpleado.apellido || !formEmpleado.cargo) {
      setMensaje({ tipo: 'error', texto: 'Nombre, apellido y cargo son obligatorios' });
      return;
    }

    try {
      const response = await fetch('/api/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEmpleado)
      });

      if (response.ok) {
        await cargarDatos();
        setFormEmpleado({
          nombre: '', apellido: '', telefono: '', email: '',
          cargo: '', departamento: '', turno: 'diurno',
          horaEntrada: '08:00', horaSalida: '17:00'
        });
        setModalEmpleado(false);
        setMensaje({ tipo: 'success', texto: 'Empleado creado correctamente' });
      }
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al crear empleado' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  const actualizarEmpleado = async () => {
    if (!modalEditar) return;

    try {
      const response = await fetch('/api/empleados', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modalEditar.id, ...formEmpleado, estado: modalEditar.estado })
      });

      if (response.ok) {
        await cargarDatos();
        setModalEditar(null);
        setFormEmpleado({
          nombre: '', apellido: '', telefono: '', email: '',
          cargo: '', departamento: '', turno: 'diurno',
          horaEntrada: '08:00', horaSalida: '17:00'
        });
        setMensaje({ tipo: 'success', texto: 'Empleado actualizado correctamente' });
      }
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar empleado' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  const eliminarEmpleado = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este empleado?')) return;

    try {
      await fetch('/api/empleados', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await cargarDatos();
      setMensaje({ tipo: 'success', texto: 'Empleado eliminado' });
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al eliminar empleado' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  // Asistencia manual
  const marcarAsistenciaManual = async (empleadoId: string) => {
    try {
      const response = await fetch('/api/asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empleadoId, metodo: 'manual' })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await cargarDatos();
        setMensaje({
          tipo: 'success',
          texto: `${data.asistencia.tipo === 'entrada' ? '🟢 ENTRADA' : '🔴 SALIDA'} registrada para ${data.empleado.nombre} ${data.empleado.apellido}`
        });
      } else {
        setMensaje({ tipo: 'error', texto: data.error || 'Error al registrar' });
      }
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  // Borrar historial
  const borrarHistorial = async () => {
    if (pinInput !== '1234') {
      setMensaje({ tipo: 'error', texto: 'PIN incorrecto' });
      return;
    }

    try {
      const response = await fetch('/api/asistencia', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput, confirmar: true })
      });

      if (response.ok) {
        await cargarDatos();
        setModalPin(false);
        setPinInput('');
        setMensaje({ tipo: 'success', texto: 'Historial borrado correctamente' });
      }
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al borrar historial' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  // Guardar configuración
  const guardarConfiguracion = async () => {
    if (!configuracion) return;

    try {
      const response = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configuracion)
      });

      if (response.ok) {
        setMensaje({ tipo: 'success', texto: 'Configuración guardada correctamente' });
      }
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar configuración' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  // Generar QR para carnet
  const generarQRCarnet = (empleado: Empleado) => {
    const qrData = empleado.codigoQr;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
  };

  // Descargar carnet
  const descargarCarnet = async (empleado: Empleado) => {
    const qrUrl = generarQRCarnet(empleado);

    const canvas = document.createElement('canvas');
    canvas.width = 350;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Fondo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 350, 500);

    // Borde
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 330, 480);

    // Header
    ctx.fillStyle = '#059669';
    ctx.fillRect(10, 10, 330, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(configuracion?.nombreEmpresa || 'EMPRESA', 175, 45);

    // Datos del empleado
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(`${empleado.nombre} ${empleado.apellido}`, 175, 110);

    ctx.font = '16px Arial';
    ctx.fillStyle = '#374151';
    ctx.fillText(empleado.cargo, 175, 140);

    if (empleado.departamento) {
      ctx.font = '14px Arial';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(empleado.departamento, 175, 165);
    }

    // Línea divisoria
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 180);
    ctx.lineTo(320, 180);
    ctx.stroke();

    // Información adicional
    ctx.font = '14px Arial';
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'left';
    ctx.fillText(`Código: ${empleado.codigo}`, 30, 210);
    ctx.fillText(`Turno: ${empleado.turno.toUpperCase()}`, 30, 235);
    ctx.fillText(`Horario: ${empleado.horaEntrada} - ${empleado.horaSalida}`, 30, 260);

    if (empleado.telefono) {
      ctx.fillText(`Tel: ${empleado.telefono}`, 30, 285);
    }

    // Cargar y dibujar QR
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = qrUrl;

      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, 75, 310, 200, 200);
          resolve();
        };
        img.onerror = () => resolve();
      });
    } catch {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(75, 310, 200, 200);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Código QR', 175, 410);
    }

    // Descargar
    const link = document.createElement('a');
    link.download = `carnet_${empleado.codigo}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Filtros
  const empleadosFiltrados = empleados.filter(e =>
    `${e.nombre} ${e.apellido} ${e.cargo} ${e.codigo}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Acceso admin
  const accederAdmin = () => {
    if (passwordAdmin === 'admin123') {
      setModo('admin');
      setErrorPassword('');
      setPasswordAdmin('');
    } else {
      setErrorPassword('Contraseña incorrecta');
    }
  };

  // Pantalla de selección
  if (modo === 'seleccion') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-emerald-50 to-teal-100'}`}>
        <div className="absolute top-4 right-4">
          <button onClick={toggleDarkMode} className="p-2 rounded-full bg-white/80 dark:bg-gray-800 shadow-lg">
            {darkMode ? <Sun className="w-6 h-6 text-yellow-500" /> : <Moon className="w-6 h-6 text-gray-600" />}
          </button>
        </div>

        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <Building className="w-16 h-16 mx-auto text-emerald-600 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              {configuracion?.nombreEmpresa || 'Control de Asistencia'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Sistema de Registro Empresarial</p>
          </div>

          <Card className="shadow-xl dark:bg-gray-800">
            <CardContent className="p-6 space-y-4">
              <Button
                onClick={() => setModo('recepcion')}
                className="w-full h-16 text-lg bg-emerald-600 hover:bg-emerald-700"
              >
                <Camera className="mr-3 w-6 h-6" />
                Modo Recepción / Escáner
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-gray-800 px-2 text-gray-500">o</span>
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Contraseña de administrador"
                  value={passwordAdmin}
                  onChange={(e) => setPasswordAdmin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && accederAdmin()}
                  className="h-12 dark:bg-gray-700"
                />
                {errorPassword && <p className="text-red-500 text-sm">{errorPassword}</p>}
                <Button onClick={accederAdmin} variant="outline" className="w-full h-12">
                  <Settings className="mr-2 w-5 h-5" />
                  Acceder como Administrador
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Sistema de Asistencia Empresarial v1.0
          </p>
        </div>
      </div>
    );
  }

  // Modo Recepción
  if (modo === 'recepcion') {
    return (
      <div className={`min-h-screen flex flex-col ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <header className="bg-emerald-600 text-white p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building className="w-8 h-8" />
              <div>
                <h1 className="font-bold text-lg">{configuracion?.nombreEmpresa || 'Empresa'}</h1>
                <p className="text-emerald-100 text-sm">Modo Recepción</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-emerald-700">
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Button onClick={() => setModo('seleccion')} variant="ghost" className="text-white hover:bg-emerald-700">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Scanner */}
        <main className="flex-1 p-4 max-w-md mx-auto w-full">
          <Card className="shadow-lg dark:bg-gray-800">
            <CardContent className="p-4">
              <div 
                id="qr-reader" 
                ref={scannerRef} 
                className="w-full min-h-[300px] bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"
              />
              
              {/* Controles de cámara */}
              <div className="flex gap-2 mt-4">
                {!cameraActive ? (
                  <Button onClick={startScanner} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <Camera className="w-4 h-4 mr-2" />
                    Iniciar Cámara
                  </Button>
                ) : (
                  <Button onClick={stopScanner} variant="outline" className="flex-1">
                    <CameraOff className="w-4 h-4 mr-2" />
                    Detener Cámara
                  </Button>
                )}
              </div>

              {/* Error de cámara */}
              {cameraError && (
                <Alert className="mt-4 border-red-500 bg-red-50 dark:bg-red-900/20">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-600">
                    {cameraError}
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                Escanee el código QR del empleado
              </p>
            </CardContent>
          </Card>

          {/* Mensaje de resultado */}
          {mensaje && (
            <Alert className={`mt-4 ${mensaje.tipo === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
              <div className="flex items-start gap-2">
                {mensaje.tipo === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <AlertDescription className="whitespace-pre-line font-medium dark:text-white">
                  {mensaje.texto}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Últimos registros */}
          <div className="mt-6">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Últimos registros</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {asistencias.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">
                      {a.empleado.nombre} {a.empleado.apellido}
                    </p>
                    <p className="text-xs text-gray-500">{a.empleado.cargo}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg ${a.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {a.tipo === 'entrada' ? '🟢' : '🔴'}
                    </span>
                    <p className="text-sm text-gray-500">{a.hora}</p>
                    {a.estado === 'tardanza' && (
                      <span className="text-xs text-orange-500">Tardanza</span>
                    )}
                  </div>
                </div>
              ))}
              {asistencias.length === 0 && (
                <p className="text-center text-gray-500 py-4">No hay registros hoy</p>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-emerald-600 text-white p-3 text-center text-sm">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </footer>
      </div>
    );
  }

  // Modo Admin
  return (
    <div className={`min-h-screen flex ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col">
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Building className="w-8 h-8 text-emerald-600" />
            <div>
              <h1 className="font-bold text-gray-800 dark:text-white">
                {configuracion?.nombreEmpresa || 'Empresa'}
              </h1>
              <p className="text-xs text-gray-500">Panel Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'empleados', icon: Users, label: 'Empleados' },
            { id: 'asistencia', icon: Clock, label: 'Asistencia Manual' },
            { id: 'reportes', icon: Calendar, label: 'Reportes' },
            { id: 'configuracion', icon: Settings, label: 'Configuración' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSeccionAdmin(item.id as typeof seccionAdmin)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                seccionAdmin === item.id
                  ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
              <ChevronRight className="w-4 h-4 ml-auto" />
            </button>
          ))}
        </nav>

        <div className="p-4 border-t dark:border-gray-700 space-y-2">
          <Button onClick={toggleDarkMode} variant="outline" className="w-full">
            {darkMode ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {darkMode ? 'Modo Claro' : 'Modo Oscuro'}
          </Button>
          <Button onClick={() => setModo('seleccion')} variant="ghost" className="w-full text-red-600 hover:text-red-700">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {seccionAdmin === 'dashboard' && 'Dashboard'}
              {seccionAdmin === 'empleados' && 'Gestión de Empleados'}
              {seccionAdmin === 'asistencia' && 'Asistencia Manual de Emergencia'}
              {seccionAdmin === 'reportes' && 'Reportes y Estadísticas'}
              {seccionAdmin === 'configuracion' && 'Configuración'}
            </h2>
            <Button onClick={cargarDatos} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </header>

        {/* Mensajes */}
        {mensaje && (
          <div className="p-4">
            <Alert className={mensaje.tipo === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}>
              {mensaje.tipo === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <AlertDescription>{mensaje.texto}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Contenido por sección */}
        <div className="p-6">
          {/* Dashboard */}
          {seccionAdmin === 'dashboard' && resumen && (
            <div className="space-y-6">
              {/* Tarjetas de resumen */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="dark:bg-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Empleados</p>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white">{resumen.totalEmpleados}</p>
                      </div>
                      <Users className="w-10 h-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="dark:bg-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Presentes Hoy</p>
                        <p className="text-3xl font-bold text-green-600">{resumen.presentes}</p>
                      </div>
                      <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="dark:bg-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Ausentes</p>
                        <p className="text-3xl font-bold text-red-600">{resumen.ausentes}</p>
                      </div>
                      <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="dark:bg-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Tardanzas</p>
                        <p className="text-3xl font-bold text-orange-600">{resumen.tardanzas}</p>
                      </div>
                      <Timer className="w-10 h-10 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Últimas asistencias */}
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="dark:text-white">Últimos Registros de Hoy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {asistencias.slice(0, 10).map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className={`w-3 h-3 rounded-full ${a.tipo === 'entrada' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">
                              {a.empleado.nombre} {a.empleado.apellido}
                            </p>
                            <p className="text-xs text-gray-500">{a.empleado.cargo}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{a.hora}</p>
                          <p className="text-xs text-gray-500">{a.tipo === 'entrada' ? 'Entrada' : 'Salida'}</p>
                          {a.estado === 'tardanza' && (
                            <span className="text-xs text-orange-500 font-medium">Tardanza</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {asistencias.length === 0 && (
                      <p className="text-center text-gray-500 py-4">No hay registros hoy</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empleados */}
          {seccionAdmin === 'empleados' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <Search className="w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="Buscar empleado..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="dark:bg-gray-700"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setModalEmpleado(true)} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Empleado
                  </Button>
                </div>
              </div>

              <Card className="dark:bg-gray-800">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Empleado</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Cargo</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Turno</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Estado</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {empleadosFiltrados.map((e) => (
                          <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-800 dark:text-white">{e.nombre} {e.apellido}</p>
                                <p className="text-xs text-gray-500">{e.codigo}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{e.cargo}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${e.turno === 'diurno' ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {e.turno.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                e.estado === 'activo' ? 'bg-green-100 text-green-700' :
                                e.estado === 'vacaciones' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {e.estado.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setModalEditar(e);
                                    setFormEmpleado({
                                      nombre: e.nombre,
                                      apellido: e.apellido,
                                      telefono: e.telefono || '',
                                      email: e.email || '',
                                      cargo: e.cargo,
                                      departamento: e.departamento || '',
                                      turno: e.turno,
                                      horaEntrada: e.horaEntrada,
                                      horaSalida: e.horaSalida
                                    });
                                  }}
                                >
                                  <Edit className="w-4 h-4 text-blue-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setModalQR(e)}>
                                  <QrCode className="w-4 h-4 text-purple-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => descargarCarnet(e)}>
                                  <Download className="w-4 h-4 text-emerald-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => eliminarEmpleado(e.id)}>
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {empleadosFiltrados.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                              No hay empleados registrados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Asistencia Manual */}
          {seccionAdmin === 'asistencia' && (
            <div className="space-y-4">
              <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <AlertDescription className="dark:text-white">
                  Use esta sección para marcar asistencia manualmente cuando un empleado no tenga su carnet QR.
                </AlertDescription>
              </Alert>

              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <Search className="w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="Buscar empleado..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="dark:bg-gray-700"
                  />
                </div>
                <Button variant="outline" onClick={() => setModalPin(true)} className="text-red-600 border-red-300">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Borrar Historial
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {empleadosFiltrados.filter(e => e.estado === 'activo').map((e) => (
                  <Card key={e.id} className="dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white">{e.nombre} {e.apellido}</p>
                          <p className="text-sm text-gray-500">{e.cargo}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${e.turno === 'diurno' ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {e.turno}
                        </span>
                      </div>
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => marcarAsistenciaManual(e.id)}
                      >
                        <LogIn className="w-4 h-4 mr-1" /> Marcar Entrada/Salida
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {empleadosFiltrados.filter(e => e.estado === 'activo').length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No hay empleados activos
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reportes */}
          {seccionAdmin === 'reportes' && (
            <div className="space-y-6">
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="dark:text-white">Historial de Asistencias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Fecha</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Empleado</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Tipo</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Hora</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Estado</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Método</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {asistencias.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {new Date(a.fecha).toLocaleDateString('es-ES')}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800 dark:text-white">{a.empleado.nombre} {a.empleado.apellido}</p>
                              <p className="text-xs text-gray-500">{a.empleado.cargo}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${a.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {a.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{a.hora}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${a.estado === 'puntual' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {a.estado.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {a.metodo === 'qr' ? 'QR' : 'Manual'}
                            </td>
                          </tr>
                        ))}
                        {asistencias.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              No hay registros de asistencia
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Configuración */}
          {seccionAdmin === 'configuracion' && configuracion && (
            <div className="max-w-2xl space-y-6">
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="dark:text-white">Datos de la Empresa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de la Empresa</label>
                    <Input
                      value={configuracion.nombreEmpresa}
                      onChange={(e) => setConfiguracion({ ...configuracion, nombreEmpresa: e.target.value })}
                      className="mt-1 dark:bg-gray-700"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</label>
                      <Input
                        value={configuracion.telefono || ''}
                        onChange={(e) => setConfiguracion({ ...configuracion, telefono: e.target.value })}
                        className="mt-1 dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                      <Input
                        type="email"
                        value={configuracion.email || ''}
                        onChange={(e) => setConfiguracion({ ...configuracion, email: e.target.value })}
                        className="mt-1 dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Dirección</label>
                    <Input
                      value={configuracion.direccion || ''}
                      onChange={(e) => setConfiguracion({ ...configuracion, direccion: e.target.value })}
                      className="mt-1 dark:bg-gray-700"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="dark:text-white">Horarios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Entrada Diurno</label>
                      <Input
                        type="time"
                        value={configuracion.horaEntradaDiurno}
                        onChange={(e) => setConfiguracion({ ...configuracion, horaEntradaDiurno: e.target.value })}
                        className="mt-1 dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Salida Diurno</label>
                      <Input
                        type="time"
                        value={configuracion.horaSalidaDiurno}
                        onChange={(e) => setConfiguracion({ ...configuracion, horaSalidaDiurno: e.target.value })}
                        className="mt-1 dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Entrada Nocturno</label>
                      <Input
                        type="time"
                        value={configuracion.horaEntradaNocturno}
                        onChange={(e) => setConfiguracion({ ...configuracion, horaEntradaNocturno: e.target.value })}
                        className="mt-1 dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Salida Nocturno</label>
                      <Input
                        type="time"
                        value={configuracion.horaSalidaNocturno}
                        onChange={(e) => setConfiguracion({ ...configuracion, horaSalidaNocturno: e.target.value })}
                        className="mt-1 dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tolerancia (minutos)</label>
                    <Input
                      type="number"
                      value={configuracion.toleranciaMinutos}
                      onChange={(e) => setConfiguracion({ ...configuracion, toleranciaMinutos: parseInt(e.target.value) || 15 })}
                      className="mt-1 dark:bg-gray-700"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="dark:text-white">Notificaciones Telegram</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Token del Bot</label>
                    <Input
                      value={configuracion.telegramToken || ''}
                      onChange={(e) => setConfiguracion({ ...configuracion, telegramToken: e.target.value })}
                      className="mt-1 dark:bg-gray-700"
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Chat ID del Dueño/Encargado</label>
                    <Input
                      value={configuracion.telegramChatIdDueno || ''}
                      onChange={(e) => setConfiguracion({ ...configuracion, telegramChatIdDueno: e.target.value })}
                      className="mt-1 dark:bg-gray-700"
                      placeholder="123456789"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    El dueño recibirá notificaciones de cada entrada/salida y un reporte diario.
                  </p>
                </CardContent>
              </Card>

              <Button onClick={guardarConfiguracion} className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Save className="w-4 h-4 mr-2" />
                Guardar Configuración
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Modal Nuevo Empleado */}
      {modalEmpleado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="dark:text-white">Nuevo Empleado</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setModalEmpleado(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre *</label>
                  <Input
                    value={formEmpleado.nombre}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, nombre: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Apellido *</label>
                  <Input
                    value={formEmpleado.apellido}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, apellido: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cargo *</label>
                <Input
                  value={formEmpleado.cargo}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, cargo: e.target.value })}
                  className="mt-1 dark:bg-gray-700"
                  placeholder="Ej: Vendedor, Supervisor, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</label>
                  <Input
                    value={formEmpleado.telefono}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, telefono: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <Input
                    type="email"
                    value={formEmpleado.email}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, email: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Departamento</label>
                <Input
                  value={formEmpleado.departamento}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, departamento: e.target.value })}
                  className="mt-1 dark:bg-gray-700"
                  placeholder="Ej: Ventas, Administración, etc."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Turno</label>
                <select
                  value={formEmpleado.turno}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, turno: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="diurno">Diurno</option>
                  <option value="nocturno">Nocturno</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Hora Entrada</label>
                  <Input
                    type="time"
                    value={formEmpleado.horaEntrada}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, horaEntrada: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Hora Salida</label>
                  <Input
                    type="time"
                    value={formEmpleado.horaSalida}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, horaSalida: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setModalEmpleado(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={crearEmpleado}>
                  Crear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Editar Empleado */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="dark:text-white">Editar Empleado</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setModalEditar(null)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
                  <Input
                    value={formEmpleado.nombre}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, nombre: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Apellido</label>
                  <Input
                    value={formEmpleado.apellido}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, apellido: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cargo</label>
                <Input
                  value={formEmpleado.cargo}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, cargo: e.target.value })}
                  className="mt-1 dark:bg-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</label>
                  <Input
                    value={formEmpleado.telefono}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, telefono: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <Input
                    value={formEmpleado.email}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, email: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Departamento</label>
                <Input
                  value={formEmpleado.departamento}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, departamento: e.target.value })}
                  className="mt-1 dark:bg-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Turno</label>
                  <select
                    value={formEmpleado.turno}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, turno: e.target.value })}
                    className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="diurno">Diurno</option>
                    <option value="nocturno">Nocturno</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                  <select
                    value={modalEditar.estado}
                    onChange={(e) => setModalEditar({ ...modalEditar, estado: e.target.value })}
                    className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="vacaciones">Vacaciones</option>
                    <option value="licencia">Licencia</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Hora Entrada</label>
                  <Input
                    type="time"
                    value={formEmpleado.horaEntrada}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, horaEntrada: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Hora Salida</label>
                  <Input
                    type="time"
                    value={formEmpleado.horaSalida}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, horaSalida: e.target.value })}
                    className="mt-1 dark:bg-gray-700"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setModalEditar(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={actualizarEmpleado}>
                  Guardar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal QR */}
      {modalQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm dark:bg-gray-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="dark:text-white">Carnet QR</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setModalQR(null)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="font-medium text-gray-800 dark:text-white">{modalQR.nombre} {modalQR.apellido}</p>
              <p className="text-sm text-gray-500">{modalQR.cargo}</p>
              <img src={generarQRCarnet(modalQR)} alt="QR" className="w-48 h-48 mx-auto" />
              <p className="text-xs text-gray-500">Código: {modalQR.codigo}</p>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => descargarCarnet(modalQR)}>
                <Download className="w-4 h-4 mr-2" />
                Descargar Carnet
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal PIN para borrar historial */}
      {modalPin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm dark:bg-gray-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="dark:text-white">Confirmar con PIN</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setModalPin(false); setPinInput(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ingrese el PIN de seguridad para borrar todo el historial de asistencias.
              </p>
              <Input
                type="password"
                placeholder="PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="dark:bg-gray-700"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setModalPin(false); setPinInput(''); }}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={borrarHistorial}>
                  Borrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
