#define AppVersion "0.8.2"
#define AppName "MLopes Finance"
#define AppPublisher "ML Lopes Design"
#define AppExeName "MLopesFinance.exe"

[Setup]
AppId={{E21E2D7B-3BA2-4F40-88F0-MLFP01000001}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
SetupIconFile=..\src\icons\appIcon.ico
DefaultDirName={localappdata}\Programs\MLopes Finance
DefaultGroupName=MLopes Finance
OutputDir=..\release
OutputBaseFilename=MLopes Finance Setup
Compression=zip
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
WizardStyle=modern
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "..\dist\MLopesFinance\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{autoprograms}\MLopes Finance"; Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\{#AppExeName}"
Name: "{autodesktop}\MLopes Finance"; Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de trabalho"; GroupDescription: "Atalhos adicionais:"

[Dirs]
Name: "{userappdata}\MLopesFinance\dados"
