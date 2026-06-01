% OpenLab plot fidelity spike: 6 canonical plots
%
% Run this in BOTH Octave AND MATLAB with NO preset / NO customization.
% Each engine saves a PNG into its own subdir; we then visually diff.
%
% Octave usage:  cd ~/projects/openlab/docs/spike-fidelity && octave-cli render.m
% MATLAB usage:  cd .../docs/spike-fidelity && run('render.m')
%
% Both engines use the same code path — only the output dir differs.
% If running in Octave: outputs go to ./octave/
% If running in MATLAB: outputs go to ./matlab/

% Auto-detect engine
if exist('OCTAVE_VERSION', 'builtin')
    outdir = './octave';
    engine = 'octave';
else
    outdir = './matlab';
    engine = 'matlab';
end
mkdir(outdir);
fprintf('Rendering reference plots for %s into %s\n', engine, outdir);

% ─── 1. Basic plot (single line) ──────────────────────────────────────────
figure(1);
t = 0:0.01:2*pi;
plot(t, sin(t));
xlabel('time (s)');
ylabel('amplitude');
title('Sine wave');
grid on;
print(fullfile(outdir, '01-plot.png'), '-dpng', '-r100');
close;

% ─── 2. Subplot with multiple lines ───────────────────────────────────────
figure(2);
subplot(2, 1, 1);
t = 0:0.01:2*pi;
plot(t, sin(t), t, cos(t), t, sin(2*t));
legend('sin(t)', 'cos(t)', 'sin(2t)', 'Location', 'best');
title('Trig functions');
grid on;

subplot(2, 1, 2);
x = linspace(-5, 5, 100);
plot(x, x.^2, x, x.^3 / 5);
legend('x^2', 'x^3/5');
title('Polynomials');
grid on;
print(fullfile(outdir, '02-subplot.png'), '-dpng', '-r100');
close;

% ─── 3. Bode plot (requires control toolbox in MATLAB / control pkg in Octave) ─
try
    if exist('OCTAVE_VERSION', 'builtin')
        pkg load control;
    end
    figure(3);
    s = tf('s');
    sys = 1 / (s^2 + 0.5*s + 1);
    bode(sys);
    title('Bode plot: 2nd order system');
    print(fullfile(outdir, '03-bode.png'), '-dpng', '-r100');
    close;
catch err
    fprintf('Bode failed (toolbox?): %s\n', err.message);
end

% ─── 4. Mesh surface ──────────────────────────────────────────────────────
figure(4);
[X, Y] = meshgrid(-3:0.2:3);
Z = peaks(X, Y);
mesh(X, Y, Z);
xlabel('X');
ylabel('Y');
zlabel('Z');
title('Mesh: peaks');
print(fullfile(outdir, '04-mesh.png'), '-dpng', '-r100');
close;

% ─── 5. Histogram ─────────────────────────────────────────────────────────
figure(5);
randn('state', 42);  % seed for reproducibility (Octave); MATLAB equivalent: rng(42)
if ~exist('OCTAVE_VERSION', 'builtin')
    rng(42);
end
data = randn(2000, 1);
hist(data, 30);
xlabel('value');
ylabel('count');
title('Histogram of 2000 N(0,1) samples');
grid on;
print(fullfile(outdir, '05-hist.png'), '-dpng', '-r100');
close;

% ─── 6. Loglog ────────────────────────────────────────────────────────────
figure(6);
f = logspace(0, 4, 100);  % 1 Hz to 10 kHz
H1 = 1 ./ (1 + 1j*f/100);
H2 = 1 ./ (1 + 1j*f/1000);
loglog(f, abs(H1), f, abs(H2));
xlabel('frequency (Hz)');
ylabel('|H(f)|');
title('Two low-pass filters');
legend('cutoff 100Hz', 'cutoff 1kHz', 'Location', 'best');
grid on;
print(fullfile(outdir, '06-loglog.png'), '-dpng', '-r100');
close;

fprintf('\nDone. Rendered 6 plots into %s\n', outdir);
fprintf('To compare: open ./octave and ./matlab side-by-side\n');
