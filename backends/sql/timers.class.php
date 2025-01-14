<?php

class timers extends database {

	private $player;

	public function __construct($player = null) {
		if ($player !== null) {
			$this->player = $player;
		} else {
			$this->player = prefs::currenthost();
		}
		prefs::set_pref(['currenthost', $this->player]);
		parent::__construct();
	}

	public function set_sleep_timer($enable, $sleeptime) {
		if ($enable == 0) {
			$this->kill_sleep_timer();
		} else {
			$this->start_sleep_timer($sleeptime);
		}
	}

	public function sleep_timer_finished() {
		$this->sql_prepare_query(true, null, null, null,
			'DELETE FROM Sleeptimers WHERE Player = ?',
			$this->player
		);
	}

	public function get_sleep_timer() {
		$default = [['Pid' => null, 'TimeSet' => 0, 'SleepTime' => 0]];
		$t = $this->sql_prepare_query(false, PDO::FETCH_ASSOC, null, $default,
			"SELECT * FROM Sleeptimers WHERE Player = ?",
			$this->player
		);
		if (count($t) == 0)
			$t = $default;

		return [
			'sleeptime' => $t[0]['SleepTime'],
			'timeset' => $t[0]['TimeSet'],
			'state' => ($t[0]['Pid'] === null) ? 0 : 1
		];
	}

	private function kill_sleep_timer() {
		$pid = $this->simple_query('Pid', 'Sleeptimers', 'Player', $this->player, null);
		if ($pid !== null) {
			logger::info($this->player, 'Cancelling Sleep Timer');
			kill_process($pid);
		}
		$this->sleep_timer_finished();
	}

	private function start_sleep_timer($sleeptime) {
		$t = $this->get_sleep_timer();
		if ($t['state'] === 1) {
			logger::log($this->player, 'Timeout was adjusted while sleep timer was running',$t['timeset'], ($sleeptime * 60), time());
			$timeout = max(1, ($t['timeset'] + ($sleeptime * 60) - time()));
			$this->kill_sleep_timer();
			$timeset = $t['timeset'];
		} else {
			$timeout = $sleeptime * 60;
			$timeset = time();
		}

		$pid = start_process($this->get_sleep_command($timeout));
		$this->sql_prepare_query(true, null, null, null,
			'INSERT INTO Sleeptimers (Pid, Player, TimeSet, SleepTime) VALUES (?, ?, ?, ?)',
			$pid, $this->player, $timeset, $sleeptime
		);
	}

	public function get_all_alarms() {
		return $this->sql_prepare_query(false, PDO::FETCH_ASSOC, null, null,
			"SELECT * FROM Alarms WHERE Player = ?",
			$this->player
		);
	}

	public function get_alarm($alarmindex) {
		$cheese = $this->sql_prepare_query(false, PDO::FETCH_ASSOC, null, null,
			"SELECT * FROM Alarms WHERE Alarmindex = ?",
			$alarmindex
		);
		return $cheese[0];
	}

	public function toggle_alarm($alarmindex, $enable) {
		// This is called in response to a click on the enable/disable icon in the UI.
		// So it works as follows:
		// If the alarm in Running, this stops it running.
		// If it's Running and a non-Repeat alarm this also marks it inactive
		// If it's running ot also toggles the snooze state.
		// If it's not running it either stops or starts it.
		// The stop/start value is toggled based on what the UI is showing it as,
		// which shouldn't be out of sync with the database but might be, so it
		// makes more sense to a user to honour the setting they can see.
		logger::log('ALARMCLOCK', 'Toggling Alarm',$alarmindex,'New State is',$enable);

		$alarm = $this->get_alarm($alarmindex);

		if ($alarm['Running'] == 1) {
			$this->toggle_snooze($alarmindex, 0);
			$this->mark_alarm_running($alarmindex, false);
			if ($alarm['Rpt'] == 0 && $alarm['Pid'] !== null) {
				// A Non-Repeat alarm might still have a Pid if it has a Stopafter setting
				kill_process($alarm['Pid']);
				$this->update_pid_for_alarm($alarmindex, null);
			}
			return;
		}

		if ($alarm['Pid'] !== null && $enable == 1) {
			logger::error('ALARMCLOCK', 'Request to enable already-enabled alarm', $alarmindex);
		} else if ($alarm['Pid'] === null && $enable == 0) {
			logger::error('ALARMCLOCK', 'Request to disable already-disabled alarm', $alarmindex);
		} else if ($enable == 0) {
			kill_process($alarm['Pid']);
			$this->update_pid_for_alarm($alarmindex, null);
		} else {
			$pid = start_process($this->get_alarm_command($alarmindex));
			// We need to set it here, even though the process will do it too.
			// The UI will need to know this info as soon as we finish.
			// having the process do it is a belt-and braces approach so we can
			// be certain we have the correct value in the table when we come to kill it.
			$this->update_pid_for_alarm($alarmindex, $pid);
		}
	}

	public function toggle_snooze($alarmindex, $enable) {
		logger::info('ALARMCLOCK', 'Toggling Snooze',$alarmindex,'New State is',$enable);
		$alarm = $this->get_alarm($alarmindex);
		if ($alarm['SnoozePid'] !== null && $enable == 1) {
			logger::error('ALARMCLOCK', 'Request to snooze already-snoozing alarm', $alarmindex);
		} else if ($alarm['SnoozePid'] === null && $enable == 0) {
			logger::error('ALARMCLOCK', 'Request to unsnooze already-unsnoozed alarm', $alarmindex);
		} else if ($enable == 0) {
			kill_process($alarm['SnoozePid']);
			$this->update_snooze_pid_for_alarm($alarmindex, null);
			// I think this makes sense.
			$this->mark_alarm_running($alarmindex, false);
		} else {
			$pid = start_process($this->get_snooze_command($alarmindex));
			// See note above
			$this->update_snooze_pid_for_alarm($alarmindex, $pid);
		}
	}

	public function update_pid_for_alarm($alarmindex, $pid) {
		$this->sql_prepare_query(true, null, null, null,
			"UPDATE Alarms SET Pid = ? WHERE Alarmindex = ?",
			$pid, $alarmindex
		);
	}

	public function update_snooze_pid_for_alarm($alarmindex, $pid) {
		$this->sql_prepare_query(true, null, null, null,
			"UPDATE Alarms SET SnoozePid = ? WHERE Alarmindex = ?",
			$pid, $alarmindex
		);
	}

	public function remove_alarm($alarmindex) {
		logger::log('ALARMCLOCK', 'Deleting Alarm',$alarmindex);
		$alarm = $this->get_alarm($alarmindex);
		if ($alarm['Pid'] !== null)
			kill_process($alarm['Pid']);

		if ($alarm['SnoozePid'] !== null)
			kill_process($alarm['SnoozePid']);

		$this->sql_prepare_query(true, null, null, null,
			"DELETE FROM Alarms WHERE Alarmindex = ?",
			$alarmindex
		);
	}

	public function edit_alarm($alarm) {
		logger::core('ALARMS', 'Editing', print_r($alarm, true));
		// It's possible to enable Repeat but not select any days.
		if ($alarm['Days'] == '')
			$alarm['Rpt'] = 0;

		if ($alarm['Alarmindex'] == 'NEW') {
			$command = 'INSERT ';
			unset($alarm['Alarmindex']);
		} else {
			$command = 'REPLACE ';
			$current_state = $this->get_alarm($alarm['Alarmindex']);
			// We NEED to do this, REPLACE INTO will set Pid to the default (of NULL)
			// if we don't explicitly set it to something
			$alarm['Pid'] = $current_state['Pid'];
			$alarm['SnoozePid'] = $current_state['SnoozePid'];
		}
		$columns = array_keys($alarm);
		$qm	= array_fill(0, count($columns), '?');
		$command .= 'INTO Alarms ('.implode(', ', $columns).') VALUES ('.implode(', ', $qm).')';
		$this->sql_prepare_query(true, null, null, null,
			$command, array_values($alarm)
		);

		if (!array_key_exists('Alarmindex', $alarm)) {
			$alarm['Alarmindex'] = $this->mysqlc->lastInsertId();
		} else if ($current_state['Pid'] !== null) {
			$this->toggle_alarm($alarm['Alarmindex'], 0);
		}
		$this->toggle_alarm($alarm['Alarmindex'], 1);
	}

	public function mark_alarm_running($alarmindex, $running) {
		$this->sql_prepare_query(true, null, null, null,
			"UPDATE Alarms SET Running = ? WHERE Alarmindex = ?",
			($running ? 1 : 0),
			$alarmindex
		);
	}

	public function check_alarm_running($alarmindex) {
		$flag = $this->simple_query('Running', 'Alarms', 'Alarmindex', $alarmindex, 0);
		return ($flag == 1);
	}

	public function mark_alarm_finished($alarmindex) {
		$this->sql_prepare_query(true, null, null, null,
			"UPDATE Alarms SET Pid = NULL WHERE Alarmindex = ?",
			$alarmindex
		);
	}

	public function stop_alarms_for_player() {
		$alarms = $this->sql_prepare_query(false, PDO::FETCH_ASSOC, null, [],
			"SELECT * FROM Alarms WHERE Player = ? AND Running = 1",
			$this->player
		);
		foreach ($alarms as $alarm) {
			$this->mark_alarm_running($alarm['Alarmindex'], false);
			// If it's not a Repeat alarm, kill the process. It might have already done that
			// but not necessarily if it has a Stopafter setting - we want Pid to get NULLed
			// so the UI knows it isn't set any more.
			if ($alarm['Pid'] !== null && $alarm['Rpt'] == 0)
				$this->toggle_alarm($alarm['Alarmindex'], 0);

			if ($alarm['SnoozePid'] !== null)
				$this->toggle_snooze($alarm['Alarmindex'], 0);

		}
	}

	public function snooze_alarms_for_player($snooze) {
		if ($snooze == 1) {
			$alarms = $this->sql_prepare_query(false, PDO::FETCH_ASSOC, null, [],
				"SELECT * FROM Alarms WHERE Player = ? AND Running = 1 AND SnoozePid IS NULL",
				$this->player
			);
		} else {
			$alarms = $this->sql_prepare_query(false, PDO::FETCH_ASSOC, null, [],
				"SELECT * FROM Alarms WHERE Player = ? AND Running = 1 AND SnoozePid IS NOT NULL",
				$this->player
			);
		}
		foreach ($alarms as $alarm) {
			$this->toggle_snooze($alarm['Alarmindex'], $snooze);
		}
	}

	public function check_alarms($restart) {
		// This is for when we're starting up and we need to ensure the alarms are running
		// We also stop any snooze timers and sleep timers, because bah.
		// This also gets called if a player definition is changed by the UI,
		// because alarms and sleep need the player info to be correct
		$poop = $this->get_all_alarms();
		foreach ($poop as $alarm) {
			if ($alarm["Pid"] !== null) {
				$actual_pid = get_pid($this->get_alarm_command($alarm['Alarmindex']));
				if ($actual_pid !== false) {
					logger::log($this->player, 'Alarm',$alarm['Alarmindex'],'is being killed');
					kill_process($actual_pid);
				}
				$this->mark_alarm_finished($alarm['Alarmindex']);
				$this->mark_alarm_running($alarm['Alarmindex'], false);
				// It doesn't make sense to restart a non-repeat alarm. We might have been
				// shut down when it was supposed to go off, and then it'll go off when
				// it's not wanted.
				if ($alarm['Rpt'] == 1 && $restart)
					$this->toggle_alarm($alarm['Alarmindex'], 1);
			}
			if ($alarm['SnoozePid'] !== null) {
				$actual_pid = get_pid($this->get_snooze_command($alarm['Alarmindex']));
				if ($actual_pid !== false) {
					logger::log($this->player, 'Stopping Snooze for',$alarm['Alarmindex']);
					kill_process($actual_pid);
				}
				$this->update_snooze_pid_for_alarm($alarm['Alarmindex'], null);
			}
		}

		$this->kill_sleep_timer();

	}

	private function get_sleep_command($timeout) {
		$pwd = getcwd();
		return $pwd.'/sleeptimer.php --currenthost '.$this->player.' --sleeptime '.$timeout;
	}

	private function get_alarm_command($alarmindex) {
		$pwd = getcwd();
		return $pwd.'/alarmclock.php --alarmindex '.$alarmindex;
	}

	private function get_snooze_command($alarmindex) {
		$pwd = getcwd();
		return $pwd.'/snoozer.php --snooze '.$alarmindex;
	}

}

?>