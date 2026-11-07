using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace OpenClaudeDesktop
{
    internal static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [STAThread]
        private static void Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string startHash = "";
            if (args != null)
            {
                for (int i = 0; i < args.Length; i++)
                {
                    if (String.Equals(args[i], "--vibe", StringComparison.OrdinalIgnoreCase))
                    {
                        startHash = "#vibe";
                    }
                }
            }

            bool createdNew = false;
            using (Mutex singleInstanceMutex = new Mutex(true, "Local\\OpenClaudeDesktopTrayMutex_v1", out createdNew))
            {
                if (!createdNew && PortHelper.IsPortOpen("127.0.0.1", 3099, 400))
                {
                    AppWindowLauncher.OpenDesktopWindow("http://127.0.0.1:3099/" + startHash, ResolveAppDir());
                    return;
                }

                Application.Run(new OpenClaudeTrayContext(ResolveAppDir(), startHash));
            }
        }

        private static string ResolveAppDir()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            if (File.Exists(Path.Combine(baseDir, "server", "index.js")))
            {
                return baseDir.TrimEnd('\\', '/');
            }
            DirectoryInfo parent = Directory.GetParent(baseDir.TrimEnd('\\', '/'));
            if (parent != null && File.Exists(Path.Combine(parent.FullName, "server", "index.js")))
            {
                return parent.FullName;
            }
            return baseDir.TrimEnd('\\', '/');
        }
    }

    internal static class PortHelper
    {
        public static bool IsPortOpen(string host, int port, int timeoutMs)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect(host, port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(timeoutMs));
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }
    }

    internal static class AppWindowLauncher
    {
        public static void OpenDesktopWindow(string url, string appDir)
        {
            string browserExe = FindChromiumBrowser();
            if (!String.IsNullOrEmpty(browserExe))
            {
                try
                {
                    string profileDir = Path.Combine(appDir, "data", "desktop-window");
                    Directory.CreateDirectory(profileDir);

                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = browserExe;
                    psi.Arguments = String.Format(
                        "--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=1480,940 --no-first-run --no-default-browser-check",
                        url,
                        profileDir
                    );
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                    return;
                }
                catch
                {
                    // Fallback below
                }
            }

            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch { }
        }

        private static string FindChromiumBrowser()
        {
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            string[] candidates = new string[]
            {
                Path.Combine(pf86, "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(pf, "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(pf, "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(pf86, "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(localApp, "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(pf, "BraveSoftware\\Brave-Browser\\Application\\brave.exe")
            };

            for (int i = 0; i < candidates.Length; i++)
            {
                if (!String.IsNullOrEmpty(candidates[i]) && File.Exists(candidates[i]))
                {
                    return candidates[i];
                }
            }
            return null;
        }
    }

    internal sealed class SplashForm : Form
    {
        private Label statusLabel;
        private ProgressBar progressBar;

        public SplashForm(Icon appIcon)
        {
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Size = new Size(440, 215);
            this.BackColor = Color.FromArgb(250, 249, 245); // #FAF9F5 Anthropic Alabaster
            this.ShowInTaskbar = true;
            this.Text = "OpenClaude";
            if (appIcon != null) this.Icon = appIcon;

            Panel topAccent = new Panel();
            topAccent.Dock = DockStyle.Top;
            topAccent.Height = 5;
            topAccent.BackColor = Color.FromArgb(217, 119, 87); // #D97757 Terracotta
            this.Controls.Add(topAccent);

            Label badgeLabel = new Label();
            badgeLabel.Text = "OPENCLAUDE DESKTOP";
            badgeLabel.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            badgeLabel.ForeColor = Color.FromArgb(217, 119, 87);
            badgeLabel.AutoSize = true;
            badgeLabel.Location = new Point(32, 30);
            this.Controls.Add(badgeLabel);

            Label titleLabel = new Label();
            titleLabel.Text = "OpenClaude";
            titleLabel.Font = new Font("Georgia", 24f, FontStyle.Regular);
            titleLabel.ForeColor = Color.FromArgb(20, 20, 19); // #141413
            titleLabel.AutoSize = true;
            titleLabel.Location = new Point(28, 52);
            this.Controls.Add(titleLabel);

            statusLabel = new Label();
            statusLabel.Text = "Starting local Vibe Studio, 9Router & Ollama gateway...";
            statusLabel.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            statusLabel.ForeColor = Color.FromArgb(107, 105, 99);
            statusLabel.Size = new Size(380, 38);
            statusLabel.Location = new Point(32, 106);
            this.Controls.Add(statusLabel);

            progressBar = new ProgressBar();
            progressBar.Style = ProgressBarStyle.Marquee;
            progressBar.MarqueeAnimationSpeed = 24;
            progressBar.Size = new Size(376, 8);
            progressBar.Location = new Point(32, 158);
            this.Controls.Add(progressBar);

            this.Paint += OnSplashPaint;
        }

        public void SetStatus(string text)
        {
            if (this.IsDisposed) return;
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action<string>(SetStatus), text);
                return;
            }
            statusLabel.Text = text;
        }

        private void OnSplashPaint(object sender, PaintEventArgs e)
        {
            using (Pen borderPen = new Pen(Color.FromArgb(224, 221, 211), 1))
            {
                e.Graphics.DrawRectangle(borderPen, 0, 0, this.Width - 1, this.Height - 1);
            }
        }
    }

    internal sealed class OpenClaudeTrayContext : ApplicationContext
    {
        private readonly string appDir;
        private readonly string initialHash;
        private readonly NotifyIcon trayIcon;
        private SplashForm splash;
        private Process serverProcess;
        private System.Windows.Forms.Timer pollTimer;
        private int pollTicks;
        private bool windowLaunched;

        public OpenClaudeTrayContext(string resolvedAppDir, string startHash)
        {
            this.appDir = resolvedAppDir;
            this.initialHash = startHash ?? "";
            this.pollTicks = 0;
            this.windowLaunched = false;

            Icon icon = LoadAppIcon(resolvedAppDir);

            ContextMenuStrip menu = new ContextMenuStrip();
            ToolStripMenuItem openMainItem = new ToolStripMenuItem("Open OpenClaude");
            openMainItem.Font = new Font(openMainItem.Font, FontStyle.Bold);
            openMainItem.Click += delegate { AppWindowLauncher.OpenDesktopWindow("http://127.0.0.1:3099/", appDir); };

            ToolStripMenuItem openVibeItem = new ToolStripMenuItem("Open Vibe Coding Studio (PC)");
            openVibeItem.Click += delegate { AppWindowLauncher.OpenDesktopWindow("http://127.0.0.1:3099/#vibe", appDir); };

            ToolStripMenuItem openWorkspaceFolderItem = new ToolStripMenuItem("Open PC Workspace Folder");
            openWorkspaceFolderItem.Click += delegate
            {
                string wsPath = Path.Combine(appDir, "workspace");
                Directory.CreateDirectory(wsPath);
                try { Process.Start("explorer.exe", "\"" + wsPath + "\""); } catch { }
            };

            ToolStripMenuItem openNineRouterItem = new ToolStripMenuItem("Open 9Router Dashboard (:20128)");
            openNineRouterItem.Click += delegate
            {
                try { Process.Start(new ProcessStartInfo("http://localhost:20128/dashboard") { UseShellExecute = true }); } catch { }
            };

            ToolStripMenuItem quitItem = new ToolStripMenuItem("Quit OpenClaude");
            quitItem.Click += delegate { ShutdownAndExit(); };

            menu.Items.Add(openMainItem);
            menu.Items.Add(openVibeItem);
            menu.Items.Add(openWorkspaceFolderItem);
            menu.Items.Add(openNineRouterItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(quitItem);

            trayIcon = new NotifyIcon();
            trayIcon.Icon = icon;
            trayIcon.Text = "OpenClaude — Local AI & Vibe Coding Suite";
            trayIcon.ContextMenuStrip = menu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += delegate { AppWindowLauncher.OpenDesktopWindow("http://127.0.0.1:3099/", appDir); };

            if (PortHelper.IsPortOpen("127.0.0.1", 3099, 400))
            {
                windowLaunched = true;
                AppWindowLauncher.OpenDesktopWindow("http://127.0.0.1:3099/" + initialHash, appDir);
            }
            else
            {
                splash = new SplashForm(icon);
                splash.Show();
                Application.DoEvents();

                ThreadPool.QueueUserWorkItem(delegate { EnsureBuildAndSpawnServer(); });

                pollTimer = new System.Windows.Forms.Timer();
                pollTimer.Interval = 400;
                pollTimer.Tick += OnPollServerTick;
                pollTimer.Start();
            }
        }

        private Icon LoadAppIcon(string dir)
        {
            try
            {
                string icoFile = Path.Combine(dir, "assets", "openclaude.ico");
                if (File.Exists(icoFile))
                {
                    return new Icon(icoFile);
                }
                Icon assoc = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (assoc != null) return assoc;
            }
            catch { }
            return SystemIcons.Application;
        }

        private void EnsureBuildAndSpawnServer()
        {
            try
            {
                string distIndex = Path.Combine(appDir, "dist", "index.html");
                if (!File.Exists(distIndex))
                {
                    if (splash != null) splash.SetStatus("First run: building OpenClaude production bundle...");
                    ProcessStartInfo buildPsi = new ProcessStartInfo();
                    buildPsi.FileName = "cmd.exe";
                    buildPsi.Arguments = "/c npm install --no-fund --no-audit && npm run build";
                    buildPsi.WorkingDirectory = appDir;
                    buildPsi.CreateNoWindow = true;
                    buildPsi.UseShellExecute = false;
                    Process buildProc = Process.Start(buildPsi);
                    if (buildProc != null) buildProc.WaitForExit();
                }

                if (splash != null) splash.SetStatus("Launching OpenClaude server, 9Router & Ollama...");

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "node";
                psi.Arguments = "\"" + Path.Combine(appDir, "server", "index.js") + "\"";
                psi.WorkingDirectory = appDir;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                serverProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                if (splash != null)
                {
                    splash.SetStatus("Failed to start Node.js server: " + ex.Message);
                }
            }
        }

        private void OnPollServerTick(object sender, EventArgs e)
        {
            pollTicks++;
            if (PortHelper.IsPortOpen("127.0.0.1", 3099, 250))
            {
                pollTimer.Stop();
                if (splash != null && !splash.IsDisposed)
                {
                    splash.Close();
                    splash.Dispose();
                    splash = null;
                }
                if (!windowLaunched)
                {
                    windowLaunched = true;
                    AppWindowLauncher.OpenDesktopWindow("http://127.0.0.1:3099/" + initialHash, appDir);
                }
                return;
            }

            if (pollTicks > 150) // ~60 seconds timeout
            {
                pollTimer.Stop();
                if (splash != null && !splash.IsDisposed)
                {
                    splash.Close();
                }
                MessageBox.Show(
                    "OpenClaude server did not respond on port 3099. Ensure Node.js is installed and in your PATH.",
                    "OpenClaude Desktop",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
            }
        }

        private void ShutdownAndExit()
        {
            try
            {
                if (pollTimer != null) pollTimer.Stop();
                if (trayIcon != null)
                {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                }
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    ProcessStartInfo killPsi = new ProcessStartInfo();
                    killPsi.FileName = "taskkill.exe";
                    killPsi.Arguments = "/F /T /PID " + serverProcess.Id;
                    killPsi.CreateNoWindow = true;
                    killPsi.UseShellExecute = false;
                    Process kp = Process.Start(killPsi);
                    if (kp != null) kp.WaitForExit(2000);
                }
            }
            catch { }
            Application.Exit();
        }
    }
}
