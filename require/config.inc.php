﻿<?php
	// Database-Connection variables
	$db_host = "localhost";
	$db_user = "root";
	$db_password = "";
	$db_table = "test";

	// Use mod_rewrite for url rewriting?
	// eg: host.com/c/channel-name instead of host.com/channe.php?c=channel-name when enabled.
	$enable_mod_rewrite = true;

	// Don't even think about touching this Values! - Also some other global stuff you shouldn't touch.
  $sgtube_host = '//'.$_SERVER['SERVER_NAME'];
  $sgtube_root = $sgtube_host.substr($_SERVER['SCRIPT_NAME'],0,strrpos($_SERVER['SCRIPT_NAME'],'/'));
  require_once('require/util.func.php'); //include utility functions
	$con = new mysqli($db_host, $db_user, $db_password, $db_table);
  mb_internal_encoding("UTF-8");
  $con->set_charset("utf8");
  
?>