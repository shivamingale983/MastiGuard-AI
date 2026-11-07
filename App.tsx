import React, { useState, useEffect } from 'react';
import { ScreenName, Animal, Alert, User, Language, UserRole } from './types';
import { StorageService, AppSettings, DEMO_USER } from './services/storageService';
import { MockSensorService } from './services/mockSensorService';
import { riskPredictionService } from './services/riskPredictionService';
import { SpeechService } from './services/speechService';
import { AndroidFrame } from './components/AndroidFrame';
import { BottomNavigation } from './components/BottomNavigation';
import { CollegeDocsModal } from './components/CollegeDocsModal';

// Screens
import { SplashScreen } from './screens/SplashScreen';
import { AuthScreen } from './screens/AuthScreen';
import { FarmerDashboardScreen } from './screens/FarmerDashboardScreen';
import { VeterinarianDashboardScreen } from './screens/VeterinarianDashboardScreen';
import { CooperativeDashboardScreen } from './screens/CooperativeDashboardScreen';
import { CowListScreen } from './screens/CowListScreen';
import { AddCowScreen } from './screens/AddCowScreen';
import { CowDetailsScreen } from './screens/CowDetailsScreen';
import { SensorMonitoringScreen } from './screens/SensorMonitoringScreen';
import { ManualDataScreen } from './screens/ManualDataScreen';
import { AlertsScreen } from './screens/AlertsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('splash');
  const [user, setUser] = useState<User | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());
  const [selectedAnimalId, setSelectedAnimalId] = useState<string>('COW027');
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize data on mount
  useEffect(() => {
    StorageService.init();
    const savedUser = StorageService.getUser();
    setUser(savedUser);
    setAnimals(StorageService.getAnimals());
    setAlerts(StorageService.getAlerts());
    setSettings(StorageService.getSettings());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSplashComplete = () => {
    if (user) {
      setCurrentScreen('dashboard');
    } else {
      setCurrentScreen('login');
    }
  };

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    setAnimals(StorageService.getAnimals());
    setAlerts(StorageService.getAlerts());
    setCurrentScreen('dashboard');
    showToast(
      settings.language === 'mr'
        ? `स्वागत आहे, ${authenticatedUser.name}! (${authenticatedUser.role})`
        : `Welcome, ${authenticatedUser.name}! (${authenticatedUser.role})`
    );
  };

  const handleLogout = () => {
    StorageService.setUser(null);
    setUser(null);
    setCurrentScreen('login');
  };

  const handleSwitchRole = () => {
    if (!user) {
      setCurrentScreen('login');
      return;
    }
    // Cycle roles: farmer -> veterinarian -> cooperative -> farmer
    const isVet = user.role === 'veterinarian' || user.role === 'VETERINARIAN';
    const isCoop = user.role === 'cooperative' || user.role === 'DAIRY_COOPERATIVE';
    const nextRole: UserRole = !isVet && !isCoop ? 'veterinarian' : isVet ? 'cooperative' : 'farmer';

    const updatedUser: User = {
      ...user,
      role: nextRole,
      name:
        nextRole === 'veterinarian'
          ? 'Dr. Rajesh Patil, MVSc'
          : nextRole === 'cooperative'
          ? 'Shree Krishna Cooperative'
          : 'Ramesh Patil (Farmer)',
    };
    StorageService.setUser(updatedUser);
    setUser(updatedUser);
    setCurrentScreen('dashboard');
    showToast(
      settings.language === 'mr'
        ? `भूमिका बदलली: ${nextRole.toUpperCase()}`
        : `Switched role to: ${nextRole.toUpperCase()}`
    );
  };

  const handleUpdateSettings = (partial: Partial<AppSettings>) => {
    const updated = StorageService.saveSettings(partial);
    setSettings(updated);
  };

  const handleResetData = () => {
    StorageService.resetToDemoData();
    setAnimals(StorageService.getAnimals());
    setAlerts(StorageService.getAlerts());
    setSettings(StorageService.getSettings());
    showToast(
      settings.language === 'mr'
        ? 'डेमो डेटा मूळ स्थितीत आणला गेला.'
        : 'Demo data reset successfully.'
    );
  };

  const handleSelectAnimal = (animalId: string) => {
    setSelectedAnimalId(animalId);
    setCurrentScreen('cow_details');
  };

  const handleStartMonitoring = (animalId: string) => {
    setSelectedAnimalId(animalId);
    setCurrentScreen('monitoring');
  };

  const handleAnimalUpdated = (updatedAnimal: Animal) => {
    setAnimals((prev) =>
      prev.map((a) => (a.animalId === updatedAnimal.animalId ? updatedAnimal : a))
    );
    setAlerts(StorageService.getAlerts());
  };

  const handlePlayVoiceAlert = (animalId: string) => {
    SpeechService.speakHighRiskAlert(animalId, settings.language, {
      isManual: true,
      onNotice: (notice) => showToast(notice),
      onError: (err) => showToast(err),
    });
  };

  // 12-Step Presentation Demo Trigger
  const handleTriggerDemo = () => {
    setSelectedAnimalId('COW027');
    const cow27 = animals.find((c) => c.animalId === 'COW027') || animals[0];

    if (cow27) {
      const highReading = MockSensorService.generatePresetReading(cow27, 'high');
      const pred = riskPredictionService.predict(
        highReading,
        cow27.previousMastitis,
        cow27.species
      );

      const updatedAnimal: Animal = {
        ...cow27,
        lastReading: highReading,
        lastPrediction: pred,
      };

      StorageService.saveAnimal(updatedAnimal);
      handleAnimalUpdated(updatedAnimal);

      StorageService.addAlert({
        id: `alert_${cow27.animalId}_${Date.now()}`,
        animalId: cow27.animalId,
        animalName: cow27.name,
        species: cow27.species,
        timestamp: new Date().toISOString(),
        riskScore: pred.riskScore,
        riskLevel: 'HIGH',
        factors: pred.factors.map((f) => f.factor),
        message: `High Mastitis Risk detected: ${pred.riskScore}%. Action recommended: targeted milk test.`,
        messageMarathi: `उच्च मस्टायटिस धोका आढळला: ${pred.riskScore}%. तात्काळ दुधाची तपासणी करा.`,
        messageHindi: `उच्च मस्टाइटिस जोखिम पाया गया: ${pred.riskScore}%. अनुशंसित कार्रवाई: दूध की जांच करें।`,
        isReviewed: false,
        voicePlayed: false,
        dataSource: 'Mock Sensor',
      });
      setAlerts(StorageService.getAlerts());

      if (settings.voiceAlertsEnabled) {
        SpeechService.speakHighRiskAlert(cow27.animalId, settings.language, {
          isManual: false,
          onNotice: (notice) => showToast(notice),
          onError: (err) => showToast(err),
        });
      }
    }

    setCurrentScreen('cow_details');
    showToast(
      settings.language === 'mr'
        ? 'गाय #027: उच्च धोका चाचणी सक्रिय झाली (८२% स्कोअर)'
        : 'Animal #027 (Gauri): High Risk Test Active (82% Predicted Score)'
    );
  };

  // Active selected animal object
  const currentAnimal =
    (animals || []).find((a) => a.animalId.toUpperCase() === selectedAnimalId.toUpperCase()) ||
    (animals || [])[0] ||
    ({
      id: 'cow_027',
      userId: 'farmer_01',
      animalId: 'COW027',
      name: 'Gauri',
      species: 'cow',
      ageYears: 4,
      breed: 'Holstein Friesian',
      previousMastitis: false,
      baselineMilkYield: 16.5,
      createdAt: new Date().toISOString(),
    } as Animal);

  const unreadAlertsCount = (alerts || []).filter((a) => !a.isReviewed).length;

  // Determine if bottom navigation should be shown
  const showBottomNav =
    currentScreen !== 'splash' &&
    currentScreen !== 'login' &&
    currentScreen !== 'register' &&
    currentScreen !== 'role_select';

  return (
    <AndroidFrame
      lang={settings.language}
      onToggleLang={() =>
        handleUpdateSettings({
          language:
            settings.language === 'en'
              ? 'mr'
              : settings.language === 'mr'
              ? 'hi'
              : 'en',
        })
      }
      isOnline={settings.isOnline}
      onToggleOnline={() =>
        handleUpdateSettings({ isOnline: !settings.isOnline })
      }
      onOpenDocs={() => setIsDocsOpen(true)}
      currentRole={user?.role}
      onSwitchRole={handleSwitchRole}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-900/95 text-white text-xs font-semibold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-3 max-w-xs text-center">
          {toastMessage}
        </div>
      )}

      {/* Screen Router */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {currentScreen === 'splash' && (
          <SplashScreen
            onComplete={handleSplashComplete}
            lang={settings.language}
          />
        )}

        {(currentScreen === 'login' || currentScreen === 'register') && (
          <AuthScreen
            onLoginSuccess={handleLoginSuccess}
            lang={settings.language}
          />
        )}

        {currentScreen === 'dashboard' && (
          <>
            {user?.role === 'veterinarian' || user?.role === 'VETERINARIAN' ? (
              <VeterinarianDashboardScreen
                user={user}
                animals={animals}
                alerts={alerts}
                language={settings.language}
                onNavigate={(screen, animalId) => {
                  if (animalId) setSelectedAnimalId(animalId);
                  setCurrentScreen(screen);
                }}
                onSelectAnimal={handleSelectAnimal}
              />
            ) : user?.role === 'cooperative' || user?.role === 'DAIRY_COOPERATIVE' ? (
              <CooperativeDashboardScreen
                user={user}
                animals={animals}
                alerts={alerts}
                language={settings.language}
                onNavigate={(screen, animalId) => {
                  if (animalId) setSelectedAnimalId(animalId);
                  setCurrentScreen(screen);
                }}
                onSelectAnimal={handleSelectAnimal}
              />
            ) : (
              <FarmerDashboardScreen
                user={user || DEMO_USER}
                animals={animals}
                alerts={alerts}
                language={settings.language}
                onNavigate={(screen, animalId) => {
                  if (animalId) setSelectedAnimalId(animalId);
                  setCurrentScreen(screen);
                }}
                onRunDemoEvaluator={handleTriggerDemo}
                onPlayVoiceAlert={handlePlayVoiceAlert}
              />
            )}
          </>
        )}

        {currentScreen === 'cows' && (
          <CowListScreen
            animals={animals || []}
            cows={animals || []}
            lang={settings.language}
            onSelectCow={handleSelectAnimal}
            onNavigate={(screen) => setCurrentScreen(screen)}
            onAnimalsUpdated={() => setAnimals(StorageService.getAnimals())}
            onRefreshAnimals={() => setAnimals(StorageService.getAnimals())}
          />
        )}

        {currentScreen === 'add_cow' && (
          <AddCowScreen
            onSave={(newAnimal) => {
              setAnimals(StorageService.getAnimals());
              setSelectedAnimalId(newAnimal.animalId);
              setCurrentScreen('cow_details');
              showToast(
                settings.language === 'mr'
                  ? `${newAnimal.name} नोंदणी यशस्वी.`
                  : `${newAnimal.name} added to herd successfully.`
              );
            }}
            onCancel={() => setCurrentScreen('cows')}
            lang={settings.language}
          />
        )}

        {currentScreen === 'cow_details' && (
          <CowDetailsScreen
            cow={currentAnimal}
            lang={settings.language}
            onBack={() => setCurrentScreen('cows')}
            onNavigate={(screen) => setCurrentScreen(screen)}
            onStartMonitoring={handleStartMonitoring}
            onCowUpdated={handleAnimalUpdated}
          />
        )}

        {currentScreen === 'monitoring' && (
          <SensorMonitoringScreen
            cow={currentAnimal}
            lang={settings.language}
            sensorMode={settings.sensorMode}
            onBack={() => setCurrentScreen('cow_details')}
            onCowUpdated={handleAnimalUpdated}
          />
        )}

        {currentScreen === 'manual_data' && (
          <ManualDataScreen
            animals={animals}
            preselectedAnimalId={selectedAnimalId}
            lang={settings.language}
            onBack={() => setCurrentScreen('cow_details')}
            onDataSaved={(reading, prediction) => {
              setAnimals(StorageService.getAnimals());
              setAlerts(StorageService.getAlerts());
              showToast(
                settings.language === 'mr'
                  ? 'निरीक्षण नोंदी सुरक्षित जतन झाल्या!'
                  : 'Monitoring data saved successfully!'
              );
            }}
          />
        )}

        {currentScreen === 'alerts' && (
          <AlertsScreen
            alerts={alerts}
            lang={settings.language}
            onSelectCow={handleSelectAnimal}
            onAlertsUpdated={() => setAlerts(StorageService.getAlerts())}
          />
        )}

        {currentScreen === 'history' && (
          <HistoryScreen
            cows={animals}
            selectedCowId={selectedAnimalId}
            lang={settings.language}
            onSelectCow={(id) => setSelectedAnimalId(id)}
            onBack={() => setCurrentScreen('cow_details')}
          />
        )}

        {currentScreen === 'settings' && (
          <SettingsScreen
            user={user || DEMO_USER}
            settings={settings}
            lang={settings.language}
            onUpdateSettings={handleUpdateSettings}
            onResetData={handleResetData}
            onLogout={handleLogout}
            onOpenDocs={() => setIsDocsOpen(true)}
            onSwitchRole={handleSwitchRole}
          />
        )}
      </div>

      {/* Material 3 Bottom Navigation Bar */}
      {showBottomNav && (
        <BottomNavigation
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          lang={settings.language}
          unreadAlertsCount={unreadAlertsCount}
        />
      )}

      {/* College Project Hub & System Architecture Modal */}
      <CollegeDocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />
    </AndroidFrame>
  );
}
