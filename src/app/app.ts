import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Assignment {
  name: string;
  date: string;
  dueDate: Date;
  completed: boolean;
}

interface Monster {
  id: number;
  name: string;
  x: number; // horizontal position in px (used for [style.left.px])
  speed: number; // pixels per tick
  imageSrc: string;
  dueLabel: string; // short due date label to render above monster
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  // Game state
  protected readonly hp = signal(3);
  protected readonly maxHp = signal(3);
  protected readonly streak = signal(0);
  protected readonly playerX = signal(-70);
  protected readonly enemyX = signal(100);
  protected readonly displayMessage = signal('Welcome to the Student Productivity Game! Complete assignments before they reach you!');
  protected readonly showPanel = signal(false);
  protected readonly adminButtonSrc = signal<string>('/backgrounds/@admin_button.png');
  protected readonly gameLocked = signal(false); // true when player is dead until admin unlocks

  // Multiple monsters tied to created assignments
  protected readonly monsters = signal<Monster[]>([]);

  // Keep a simple list of assignment names
  protected readonly assignmentNames = signal<string[]>([]);

  // Teacher UI state
  protected readonly students = signal<Array<{ username: string; assignments: { name: string; date: string; dueISO: string; completed: boolean; percentage: number }[] }>>([
    { username: 'Alex',  assignments: [] },
    { username: 'Blake', assignments: [] },
    { username: 'Casey', assignments: [] },
    { username: 'Devon', assignments: [] },
    { username: 'Emery', assignments: [] },
    { username: 'Finley',assignments: [] },
    { username: 'Gray',  assignments: [] },
    { username: 'Harper', assignments: [] },
  ]);
  protected newAssignmentName = '';
  protected newAssignmentDate = '';
  
  // Game data
  protected readonly currentAssignment = signal<Assignment>({
    name: 'Math Assignment',
    date: 'Oct 5th',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    completed: false
  });
  

  private gameInterval?: number;
  private cloudInterval?: number;
  private notificationTimeout?: number;

  ngOnInit() {
    this.startGame();
  }

  ngOnDestroy() {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
    }
    if (this.cloudInterval) {
      clearInterval(this.cloudInterval);
    }
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
  }

  // If durationMs is provided, auto-hide after that many ms; if omitted, persist
  private showNotification(message: string, durationMs?: number): void {
    this.displayMessage.set(message);
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = undefined as unknown as number;
    }
    if (typeof durationMs === 'number' && isFinite(durationMs) && durationMs > 0) {
      this.notificationTimeout = setTimeout(() => {
        if (this.displayMessage() === message) {
          this.displayMessage.set('');
        }
      }, durationMs) as unknown as number;
    }
  }

  // Estimate time left (seconds) for a monster to reach collision threshold
  protected getMonsterEtaSeconds(monster: Monster): number {
    const COLLISION_DISTANCE_PX = 80;
    const targetX = this.playerX() + COLLISION_DISTANCE_PX;
    const distancePx = Math.max(0, monster.x - targetX);
    const pixelsPerSecond = monster.speed * 10; // speed per 100ms tick
    if (pixelsPerSecond <= 0) { return Infinity; }
    return distancePx / pixelsPerSecond;
  }

  protected getMonsterEtaLabel(monster: Monster): string {
    const sec = this.getMonsterEtaSeconds(monster);
    if (!isFinite(sec)) { return '∞'; }
    if (sec < 60) { return `${Math.ceil(sec)}s`; }
    const mins = Math.floor(sec / 60);
    const rem = Math.ceil(sec % 60);
    return `${mins}m ${rem}s`;
  }

  private startGame() {
    // Move all monsters closer to player and detect collisions
    this.gameInterval = setInterval(() => {
      // Freeze when admin password is verified or game is locked (dead)
      if (this.adminPasswordVerified || this.gameLocked()) { return; }

      const COLLISION_DISTANCE_PX = 80;
      const targetX = this.playerX() + COLLISION_DISTANCE_PX;

      let didCollide = false;

      this.monsters.update(list => {
        const updated = list.map(m => {
          const nextX = m.x > targetX ? Math.max(targetX, m.x - m.speed) : m.x;
          return { ...m, x: nextX };
        });

        const [colliding, remaining] = updated.reduce<[Monster[], Monster[]]>((acc, m) => {
          if (m.x <= targetX) { acc[0].push(m); } else { acc[1].push(m); }
          return acc;
        }, [[], []]);

        if (colliding.length > 0) {
          didCollide = true;
          return remaining; // remove collided monsters from the field
        }
        return updated;
      });

      if (didCollide) {
        // Effects on collision
        this.streak.set(0);
        const died = this.takeDamage(1);
        if (!died) {
          this.showNotification('A monster reached you! Streak reset and -1 HP.', 3000);
        }
      }
    }, 100);

  }

  // Returns true if this hit caused death
  private takeDamage(amount: number): boolean {
    const newHp = Math.max(0, this.hp() - amount);
    this.hp.set(newHp);
    
    if (newHp <= 0) {
      // Lock the game until admin unlocks (persistent message)
      this.showNotification('You have lost all your HP! contect your admin to get back on!');
      this.gameLocked.set(true);
      return true;
    }
    return false;
  }

  // Called when a task checkbox is toggled in admin UI
  protected onToggleTaskCompletion(studentIndex: number, assignmentIndex: number): void {
    const list = this.students();
    const a = list[studentIndex]?.assignments[assignmentIndex];
    if (!a) { return; }

    // When marked complete => increment streak and remove matching monster(s)
    if (a.completed) {
      this.streak.update(s => s + 1);
      const key = (a.name || '').trim().toLowerCase();
      this.monsters.update(arr => arr.filter(m => (m.name || '').toLowerCase() !== key));
      this.showNotification(`Completed: ${a.name}. Streak +1!`, 3000);
    }
  }

  private completeAssignment() {
    this.currentAssignment.update(assignment => ({
      ...assignment,
      completed: true
    }));
    
    this.streak.update(s => s + 1);
    this.showNotification('Assignment completed! Great job! Your streak increased.', 3000);
    
    // Move enemy back
    this.enemyX.set(200);
    
    // Create new assignment
    setTimeout(() => {
      this.createNewAssignment();
    }, 2000);
  }

  private createNewAssignment() {
    const assignments = ['Math Homework', 'Science Project', 'English Essay', 'History Report', 'Coding Challenge'];
    const randomAssignment = assignments[Math.floor(Math.random() * assignments.length)];
    const dueDate = new Date(Date.now() + (Math.random() * 3 + 1) * 24 * 60 * 60 * 1000); // 1-4 days
    
    this.currentAssignment.set({
      name: randomAssignment,
      date: dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dueDate: dueDate,
      completed: false
    });
    
    this.enemyX.set(200);
    this.showNotification(`New assignment: ${randomAssignment}. Complete it before the due date!`, 3000);
  }

  private resetGame() {
    this.hp.set(3);
    this.streak.set(0);
    this.enemyX.set(200);
    this.monsters.set([]);
    this.createNewAssignment();
  }

  // Event handlers referenced from the template
  protected onEnemyLoad(): void {
    // Intentionally empty; reserved for future logging/analytics
  }

  protected onEnemyError(): void {
    // Intentionally empty; could set a fallback image here if needed
  }

  // UI panel controls
  protected openPanel(): void { this.showPanel.set(true); }
  protected closePanel(): void { this.showPanel.set(false); }
  protected onAdminImgError(): void {
    // Fallback to non-@ filename if provided asset doesn't exist
    this.adminButtonSrc.set('/backgrounds/admin_button.png');
  }

  // --- Admin modal / password-protected UI state ---
  protected adminShowModal = false;
  protected adminPassword: string | null = null; // null = not set yet
  protected adminPasswordInput = '';
  protected adminPasswordError = '';
  protected adminIsSettingPassword = false;
  protected adminPasswordVerified = false;
  protected adminShowChangePassword = false;
  protected adminNewPasswordInput = '';
  protected adminConfirmNewPasswordInput = '';
  protected adminCurrentPasswordInput = '';
  protected adminChangePasswordError = '';

  protected openAdminModal() {
    this.adminPasswordError = '';
    this.adminShowChangePassword = false;
    this.adminNewPasswordInput = '';
    this.adminConfirmNewPasswordInput = '';
    this.adminChangePasswordError = '';
    if (this.adminPassword === null) {
      // first time: prompt to set password
      this.adminIsSettingPassword = true;
      this.adminPasswordVerified = false;
      this.adminShowModal = true;
    } else {
      // subsequent times: ask for password
      this.adminIsSettingPassword = false;
      this.adminPasswordVerified = false;
      this.adminShowModal = true;
    }
  }

  protected submitAdminPassword() {
    if (this.adminIsSettingPassword) {
      if (!this.adminPasswordInput.trim()) {
        this.adminPasswordError = 'Password cannot be empty.';
        return;
      }
      this.adminPassword = this.adminPasswordInput;
      this.adminPasswordInput = '';
      this.adminIsSettingPassword = false;
      this.adminPasswordVerified = true;
      this.adminShowModal = true;
      this.adminPasswordError = '';
    } else {
      if (this.adminPasswordInput === this.adminPassword) {
        this.adminPasswordVerified = true;
        this.adminPasswordInput = '';
        this.adminPasswordError = '';
        // If the game is locked due to death, unlock and revive now
        if (this.gameLocked()) {
          this.hp.set(this.maxHp());
          this.gameLocked.set(false);
          this.showNotification('Revived by Admin. Get back to it!', 3000);
          if (this.notificationTimeout) { clearTimeout(this.notificationTimeout); }
          // Optionally close modal to resume
          this.closeAdminModal();
        }
      } else {
        this.adminPasswordError = 'Incorrect password.';
      }
    }
  }

  protected closeAdminModal() {
    this.adminShowModal = false;
    this.adminPasswordVerified = false;
    this.adminPasswordInput = '';
    this.adminPasswordError = '';
    this.adminShowChangePassword = false;
    this.adminNewPasswordInput = '';
    this.adminConfirmNewPasswordInput = '';
    this.adminChangePasswordError = '';
  }

  protected startAdminChangePassword() {
    this.adminShowChangePassword = true;
    this.adminNewPasswordInput = '';
    this.adminConfirmNewPasswordInput = '';
    this.adminCurrentPasswordInput = '';
    this.adminChangePasswordError = '';
  }

  protected submitAdminChangePassword() {
    // require current password and new/confirm fields
    if (!this.adminCurrentPasswordInput.trim() || !this.adminNewPasswordInput.trim() || !this.adminConfirmNewPasswordInput.trim()) {
      this.adminChangePasswordError = 'All fields are required.';
      return;
    }
    if (this.adminCurrentPasswordInput !== (this.adminPassword ?? '')) {
      this.adminChangePasswordError = 'Current password is incorrect.';
      return;
    }
    if (this.adminNewPasswordInput !== this.adminConfirmNewPasswordInput) {
      this.adminChangePasswordError = 'Passwords do not match.';
      return;
    }
    if (this.adminNewPasswordInput === this.adminPassword) {
      this.adminChangePasswordError = 'New password must be different.';
      return;
    }
    // Apply change
    this.adminPassword = this.adminNewPasswordInput;
    this.adminShowChangePassword = false;
    this.adminNewPasswordInput = '';
    this.adminConfirmNewPasswordInput = '';
    this.adminCurrentPasswordInput = '';
    this.adminChangePasswordError = '';
    this.adminPasswordVerified = false;
    this.closeAdminModal();
    // Re-open to require entry of new password
    setTimeout(() => {
      this.openAdminModal();
    }, 100);
  }

  protected addAssignment(): void {
    const name = this.newAssignmentName?.trim();
    if (!name) { return; }
    const dateStr = this.newAssignmentDate || new Date().toISOString().slice(0,10);
    // Treat date-only inputs (YYYY-MM-DD) as local end-of-day to avoid timezone issues
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
    const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    this.students.update(list => list.map(s => ({
      ...s,
      assignments: [
        ...s.assignments,
        { name, date: dateLabel, dueISO: date.toISOString(), completed: false, percentage: 0 }
      ]
    })));
    this.newAssignmentName = '';
    this.newAssignmentDate = '';

    // Track assignment name in simple list
    this.assignmentNames.update(arr => [...arr, name]);

    // Spawn a monster for this assignment on the right side
    const newMonster: Monster = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      name,
      x: 1325,
      speed: 2,
      imageSrc: this.pickEnemyForName(name),
      dueLabel: dateLabel
    };
    this.monsters.update(list => [...list, newMonster]);
    this.showNotification(`New assignment created: ${name}`, 3000);
  }

  protected deleteAssignmentForAll(nameToDelete: string): void {
    const key = (nameToDelete || '').trim().toLowerCase();
    if (!key) { return; }
    this.students.update(list => list.map(s => ({
      ...s,
      assignments: s.assignments.filter(a => a.name.toLowerCase() !== key)
    })));
  }

  // Helper used in template to avoid complex/new expressions there
  protected isOverdue(dueISO: string): boolean {
    try {
      const due = new Date(dueISO).getTime();
      return due < Date.now();
    } catch {
      return false;
    }
  }

  private pickEnemyForName(name: string): string {
    const lower = (name || '').toLowerCase();
    if (lower.includes('quiz')) {
      const golems = ['/enemies/water_golem.png', '/enemies/old_golem.png', '/enemies/fire_golem.png'];
      return golems[Math.floor(Math.random() * golems.length)];
    }
    if (lower.includes('assignment')) {
      const slimes = ['/enemies/red_slime.png', '/enemies/blue_slime.png', '/enemies/green_slime.png'];
      return slimes[Math.floor(Math.random() * slimes.length)];
    }
    if (lower.includes('exam')) {
      return '/enemies/pixil-layer-0.png';
    }
    // Default to a slime if neither keyword present
    return '/enemies/blue_slime.png';
  }

}