---
title: "[TP-LINK] FIRMWARE ANALYZE #4 - #1. How To Get FIRMWARE"
description: "Usually, when a company is working on a project, one project ends and another project begins immediately afterward. In my first project, I was able to learn a lot of new technologies and improve my technical skills, including my existing analytical skills. Therefore, I was looking forward to what more I could learn and grow in the next project... but time has come."
date: "2025-08-28"
translation_key: "tistory-27d29bcca2fa"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/FIRMWARE-%EA%B0%9C%EC%9D%B8-%EA%B3%B5%EB%B6%80-%EC%A4%91-%EB%B6%84%EC%84%9D%EC%9D%B4-%EB%81%9D%EB%82%9C-%EC%9D%B4%ED%9B%84-%EA%B3%B5%EA%B0%9C%EB%A1%9C-%EC%A0%84%ED%99%98-%EC%98%88%EC%A0%95"
private: false
---

Usually, when a company is working on a project, one project ends and another project begins immediately afterward.  
   
In my first project, I was able to learn a lot of new technologies and improve my technical skills, including my existing analytical skills. Therefore, I was looking forward to what more I could learn and grow in the next project...  
A time has arisen.   
   
Thanks to this, I had some free time, but I decided to use this time as an opportunity to make the newly learned skills my own and further analyze and research them myself.  
   
Now, we plan to conduct analysis targeting one or more IoT devices every quarter.   
 

* * *

## TARGET

As always, I thought a lot about what kind of target I should target.   
   
Should I try to set a new target, or should I try again with a model I have experience with before?  
   
The final choice was once again a wireless router.  
The reason is simple. When studying a field I am interested in, I like to slowly build up from the basics and create it with my own skills.  
I have previously tried disassembling wireless routers about three times through team and individual projects, but none of them produced successful results, and since I have only had the experience of using the equipment myself once, I chose this time with the goal of unconditionally searching for vulnerabilities and developing hardware hacking technologies and vulnerability detection/analysis technologies further than now.  
After this project, I plan to reinstall the TAPO IPCAM that I previously disassembled.  
   
Wireless routers also have different firmware configuration methods depending on the manufacturer.  
There are various such as iptime, tplink, asus, etc., but first of all, we used non-domestic manufacturers as the standard.  
   
After analyzing backdoors and 1-day cases, we selected tplink wireless router as the target.   
Here again, it depends on what model you use, but if possible, I wanted to use equipment that was in high demand and whose price was relatively low.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/001.jpg)

\[TPLINK ARI R5\]

   
We chose the TPLINK AIR R5 model because it has a different design from other previously released models and has the advantage of taking up less space and being able to be installed anywhere.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/002.png)

   
The price range......  
I paid a lot thinking it was an investment for the future....  
   
Since the equipment has been opened with as little damage as possible and the internal firmware has been extracted and will only be used to verify vulnerabilities, I will try to dispose of it cheaply after the project is completed. If you are interested, please contact me...  
 

* * *

## FIRMWARE-ONLINE

[https://www.tp-link.com/kr/support/download/archer-air-r5/](https://www.tp-link.com/kr/support/download/archer-air-r5/) 

 [Download Archer Air R5 | TP-Link South Korea

TP Link - Download Center Detail

www.tp-link.com](https://www.tp-link.com/kr/support/download/archer-air-r5/)

![](/assets/images/tistory/tistory-27d29bcca2fa/003.png)

   
First of all, like iptime, TP-LINK also uploads its firmware file to the Internet.  
Encrypt it...  
   
[https://github.com/watchfulip/tp-link-decrypt](https://github.com/watchfulip/tp-link-decrypt)

 [GitHub - watchfulip/tp-link-decrypt: Decrypt TP-Link Firmware

Decrypt TP-Link Firmware. Contribute to watchfulip/tp-link-decrypt development by creating an account on GitHub.

github.com](https://github.com/watchfulip/tp-link-decrypt)

Fortunately, a decryption script is available on github.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/004.png)

The decryption process is skipped here. Later, I will explain how to extract firmware and RFS from hardware.  
   
First, primary analysis was performed on the firmware file extracted in this way.  
Unfortunately, html and lua files do not exist here, so web-based analysis was performed using uhttpd.  
For some files, it appears that web files are composed using uhttpd's internal logic.  
   
In the previous post, I said to look at the /etc/rc.d path to analyze firmware. 

![](/assets/images/tistory/tistory-27d29bcca2fa/005.png)

There's a bit more this time...  
   
In this case, first find a script that executes these friends sequentially.

![](/assets/images/tistory/tistory-27d29bcca2fa/006.png)

   
You can start the analysis focusing on the /etc/inittab and /etc/init.d/rcS scripts.  
   
When analyzing, there is code like the following. This part is the friends that execute the scripts located in /etc/rc.d/.

```
if [ "$1" = "S" -a "$foreground" != "1" ]; then
        run_scripts "$1" "$2" &
else
        run_scripts "$1" "$2"
fi
```

   
   
   
   
 

* * *

## FIRMWARE-HARDWARE

Now, this time, we will extract it from hardware equipment and try to analyze it.  
I eventually acquired the equipment to learn hardware hacking techniques and master the skills properly.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/007.png)

As soon as the equipment arrived, I disassembled it immediately. It is a product that is not fixed with screws, but is fitted with flaws on the outside and inside.  
Thanks to this, it took some time just to open the lid.  
   
If you look at the state of the board, you can see silver plates, all of which can be removed.

![](/assets/images/tistory/tistory-27d29bcca2fa/008.png)

   
   
Now I just need to find the UART, but the multi-tester I had at home couldn't measure properly, so I took it to the company and had it done.  
 

#### UART

UART is one of the hardware-based communication protocols and is a representative serial communication protocol.  
Unlike parallel, it has a structure that receives data sequentially, one bit at a time, so it can easily and stably transmit and receive data.  
 From embedded devices, you can obtain various information such as kernel messages, debug logs, and boot logs, and for some devices, you can even obtain a shell right away.  
   
With this friend called UART, you can acquire firmware or access the command shell.  
Of course, you not only need the target equipment, but you also need connectors such as USB to Serial... and jumper cables.  
   
UART uses a total of 4 pins.

- TX: Data transmission
- RX: Data reception
- GND: Ground
- VCC: Voltage

Finding it is simple. 

![](/assets/images/tistory/tistory-27d29bcca2fa/009.png)

First, set the multitester to continuity test mode (buzzer). It is usually marked in the shape of a speaker.  
In this state, if you bring the red and black lead wires to the board, the part that rings is GND.  
Usually, one lead wire is connected to a metal shield case or the outside of a port, but I tend to use the pins of flash memory more.

![](/assets/images/tistory/tistory-27d29bcca2fa/010.png)

The location may vary depending on which flash memory is attached.   
The picture above is a data sheet for one of the ESMT flash memories. (This is not the flash memory of the current target device. I just took that image as an example.)  
If you look at the data sheet, you can see that VSS, one of the 8 pins, is a GND pin, so you can know one definitive GND.   
After that, if you bring another lead wire here and there and make it ring, that is also GND.  
   
When finding the remaining RX, TX, and VCC, you must turn on the power to the board.  
With the power connected, connect the black lead to GND and move the red lead to find it.  
   
In this case, the multi-tester must be changed to voltage measurement rather than continuity test mode (buzzer).

![](/assets/images/tistory/tistory-27d29bcca2fa/011.png)

- RX: approx. 0.0
-TX: approx. 1.8
- VCC: about 3.3 or 5.5

![](/assets/images/tistory/tistory-27d29bcca2fa/012.png)

In the case of the PCB in question, the UART part is visible immediately, but there are many friends who do not.  
These kids really have to work hard to connect all the pins one by one...  
   
Once you've found everything, it's time to make a full-fledged connection.  
GND <-> GND  
RX <-> TX  
TX <-> RX  
VCC-X  
There is no need to connect VCC because you will boot by connecting the power after connection.  
Since RX is responsible for data reception, it must be connected to the transmitting TX. Likewise, TX can be connected to RX.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/013.png)

   
   
Afterwards, prepare the terminal.  
If it's Windows, you can prepare a terminal like Putty, but I'm a MacBook user... so I open a terminal.  
   
If you look at the /dev/ path, you can see information about connected devices.  
At this time, if you connect the USB to Serial, you can see \[tty.usbserial-0001\] as shown below.

![](/assets/images/tistory/tistory-27d29bcca2fa/014.png)

   
You can just copy the name and write it as shown below, but at this time, you need to find out the baud rate.

```
screen /dev/tty.usbserial-0001 [baudrate]
```

Although there is special equipment, there is no need to have it.  
[https://lucidar.me/en/serialib/most-used-baud-rates-table/](https://lucidar.me/en/serialib/most-used-baud-rates-table/)

 [Most common baud rates table | Lulu's blog

<!-- Accordez-moi une faveur, prenez quelques instants pour découvrir mon dernier projet. Merci, Lulu --> Most common baud rates table The following table shows the most used baud rates. The left side part of the table shows speed and bit duration. The

lucidar.me](https://lucidar.me/en/serialib/most-used-baud-rates-table/)

If you look at these sites, frequently used friends are organized.

![](/assets/images/tistory/tistory-27d29bcca2fa/015.png)

   
I know that the value of 115200 is usually used, but there are cases where this is not the case.  
   
Once you enter the wrong baudrate, unreadable characters appear as shown below.

![](/assets/images/tistory/tistory-27d29bcca2fa/016.png)

   
You can find the normal baud rate by looking at the output results and entering them one by one.

![](/assets/images/tistory/tistory-27d29bcca2fa/017.png)

   
   
Now that the UART is connected properly, what can I do now?  
When you connect and connect like this, a login message may appear immediately and a command shell may open.

![](/assets/images/tistory/tistory-27d29bcca2fa/018.png)

Unfortunately, this was not the case with this TP-LINK router. The input was blocked.  
Standby state... For this router, the web runs in Lua. Therefore, it remains in a standby state until the relevant signal arrives.  
   
In this case, you will have to use another method to obtain the firmware.  
There are three main methods.  
 

#### Serial Data Output Fault Injection

There is a stage in the booting process where firmware is executed.   
At this time, when an interrupt is generated, a bootloader shell is executed, and there is a way to obtain firmware through this method.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/019.png)The interrupt trigger key may be different for each device, but in this device's case, it was the Enter key.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/020.png)

This is the result of entering the help command, and it appears to be a structure that executes with a memory address rather than a general boot method.  
In addition, since boot-related environment variables are not set, the commonly used method of adding a shell or telnet to the environment variables and having them run at booting is not possible.  
   
Although the most known method does not work, there are still two methods remaining.  
One way is to use USB, but if you look at the PCB board, it is not possible because there are no ports.  
   
Then, you can use the last remaining method, the network.  
If you look at the bootloader shell, tftpput is supported.  
tftpput is a command that allows you to upload a file from a local device to a remote TFTP server using TFTP (Trivial File Transfer Protocol).  
   
You can use this command to DUMP the firmware image and then send it.  
First, set the environment variables with the setenv command.

![](/assets/images/tistory/tistory-27d29bcca2fa/021.png)

```
setenv ipaddr = 172.16.10.2 #라우터
setenv serverip = 172.16.10.67 #개인 PC
setenv gatewayip = 172.16.10.2 #라우터와 동일
setenv netmask = 255.255.255.0
```

At first, I thought it must be the 192.168.0.XXX band, but when I connected it, it was a different band.  
   
Now that preparations are complete on the router side, open the TFTP server on the terminal side. At this time, you must open it to receive files.  
   
After setting as above, open DUMP and send using the command below.  
Memory offset can be checked through the smeminfo command.

![](/assets/images/tistory/tistory-27d29bcca2fa/022.png)

```
nand read 0x44000000 0x0 0x4000000
tftpput 0x44000000 0x4000000 nand_full.bin
```

![](/assets/images/tistory/tistory-27d29bcca2fa/023.png)

If “died” appears like this, the settings on the TFTP server are incorrect.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/024.png)

If you have set it up properly, you will see a pop-up like this showing that the firmware file has been sent and received.  
   
The flash memory in this device is a NAND chip.   
Therefore, I assumed that there would be a lot of bad blocks including OOB, but since the friend that was loaded into memory was moved with a DUMP, a normal firmware file was extracted.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/025.png)

```
dd if=nand_full.bin of=ubi_A.ubi bs=1 skip=$((0x640000)) count=$((0x2A00000))
dd if=nand_full.bin of=ubi_B.ubi bs=1 skip=$((0x30A0000)) count=$((0x2A00000))

ubireader_extract_images ubi_A.ubi 

cd ubi_A.ubi/
unsquashfs  img-794303425_vol-ubi_rootfs.ubifs
```

You can see that it was extracted well.  
   
If this method does not work, you must perform a Glitching Attack.  
There is a data sheet picture among the pictures above, and you can see that there is an SO pin.  
   
Glitching Attack: This attack connects the SO pin and GND during booting to force the bootloader shell to run.  
In this regard, it was conducted on the TAPO C200 model, not the target equipment.

![](/assets/images/tistory/tistory-27d29bcca2fa/026.png)

Because it is camera equipment, the board is small.   
There is a section on the right that looks like a UART, but there are only GND and VCC there... so you have to find those small pins one by one.

![](/assets/images/tistory/tistory-27d29bcca2fa/027.png)

   
Since the pins are really small, I connected them with a PCBite.

There is a terminal that appears to be UART, but the connection is disconnected in the middle. 

Therefore, I needed to connect it by soldering, but I had a good friend at the company called PCBite, so I used it right away.

  
When connected to the UART, a login command shell appears immediately, but since I do not know the password, I used the bootloader shell.

![](/assets/images/tistory/tistory-27d29bcca2fa/028.png)

You need to look up the data sheet for your flash memory and find the SO/DO.  
   
 

![](/assets/images/tistory/tistory-27d29bcca2fa/029.png)

You can see that there is DO in the second position from the left.  
Now, when you connect the power and contact the corresponding pin and GND, the bootloader shell is executed as shown below. (This is what it looks like when you entered the Help command.)

![](/assets/images/tistory/tistory-27d29bcca2fa/030.png)

   
The method of using the network that was done previously seems impossible because there are no related commands.

![](/assets/images/tistory/tistory-27d29bcca2fa/031.png)

In this case, it is said that the process is done by manipulating the environment variables... The PCB board suddenly died, so no further progress could be made.  
Let's start repurchasing equipment...   
   
Another way is to use flashrom now. This requires expensive equipment called PCBite, so it is difficult to do it personally at home.  
You also need a Raspberry Pi.

![](/assets/images/tistory/tistory-27d29bcca2fa/032.png)

Each pin of the Raspberry Pi has a role, and the pins must be connected by referring to the role configuration and data sheet.

![](/assets/images/tistory/tistory-27d29bcca2fa/033.png)

There may be differences for each flash memory, but you can connect it like this.  
   
The last method is to simply remove the flash memory and read it directly.  
   
Since we are in an environment where we can obtain firmware without having to go through these two methods, we will write more about this as we proceed with the work.

* * *

## Analyze #1

The friend that needs to be analyzed first is /etc/inittab -> /etc/init.d/rcS -> /etc/rc.d/\*.

![](/assets/images/tistory/tistory-27d29bcca2fa/034.png)When booting, /etc/init.d/rcS is run with the S argument.

```
#!/bin/sh
# Copyright (C) 2006 OpenWrt.org

. /lib/functions.sh

run_scripts_K() {
	timeout_reboot_f &
	for i in /etc/rc.d/$1*; do
		config_load sysmode
		config_get initlist sysmode initial
		find=0
		fname=`echo $i | sed 's/\/etc\/rc\.d\/K[0-9]*//g'`
		for j in $initlist; do
			[ "$j" = "$fname" ] && {
				let find=1
				break
			}
		done
		[ $find = 0 -a -x $i ] && $i $2 2>&1
	done | $LOGGER
}

run_scripts() {
	for i in /etc/rc.d/$1*; do
		config_load sysmode
		config_get initlist sysmode initial
		find=0
		fname=`echo $i | sed 's/\/etc\/rc\.d\/S[0-9]*//g'`
		for j in $initlist; do
			[ "$j" = "$fname" ] && {
				let find=1
				break
			}
		done
		[ $find = 0 -a -x $i ] && $i $2 2>&1
	done | $LOGGER
}

system_config() {
	config_get_bool foreground $1 foreground 0
}

LOGGER="cat"
[ -x /usr/bin/logger ] && LOGGER="logger -s -p 6 -t sysinit"

config_load system
config_foreach system_config system

if [ "$1" = "S" -a "$foreground" != "1" ]; then
	run_scripts "$1" "$2" &
elif [ "$1" = "K" ]; then
	run_scripts_K "$1" "$2"
else
	run_scripts "$1" "$2"
fi
```

This script is responsible for executing scripts starting with S located in /etc/rc.d/ during the booting process.

And when the system is shut down, it executes and terminates scripts that start with K.

![](/assets/images/tistory/tistory-27d29bcca2fa/035.png)

These are scripts for initial settings between booting and shutdown.

(Most scripts are linked to the /etc/init.d/ path.)

Here, if it is the original equipment, there is something called failsafe mode.

To enter, connect the power and press the reset button for a few seconds.

Usually, when entering this mode, telnetd-related services are executed, so I looked for related operations.

```
	ln -sf /tmp/resolv.conf.auto /tmp/resolv.conf
	grep -q debugfs /proc/filesystems && mount -t debugfs debugfs /sys/kernel/debug
	[ "$FAILSAFE" = "true" ] && touch /tmp/.failsafe
	[ -d  /storage ] && mount -t jffs2 mtd:storage /storage
	[ -d  /data ] && mount -t jffs2 mtd:data /data
	# mount_tpdata move to /lib/preinit
```

You can check whether this part is running by estimating /etc/init.d/boot.

```
#!/bin/sh
# Copyright (C) 2006 OpenWrt.org
# Copyright (C) 2010 Vertical Communications

export PATH=/bin:/sbin:/usr/bin:/usr/sbin

pi_ifname=
pi_ip=192.168.1.1
pi_broadcast=192.168.1.255
pi_netmask=255.255.255.0

fs_failsafe_ifname=
fs_failsafe_ip=192.168.1.1
fs_failsafe_broadcast=192.168.1.255
fs_failsafe_netmask=255.255.255.0

fs_failsafe_wait_timeout=2

pi_suppress_stderr="y"
pi_init_suppress_stderr="y"
pi_init_path="/bin:/sbin:/usr/bin:/usr/sbin"
pi_init_cmd="/sbin/init"

. /lib/functions.sh
. /lib/functions/boot.sh

boot_hook_init preinit_essential
boot_hook_init preinit_main
boot_hook_init failsafe
boot_hook_init initramfs
boot_hook_init preinit_mount_root

for pi_source_file in /lib/preinit/*; do
    . $pi_source_file
done

boot_run_hook preinit_essential

pi_mount_skip_next=false
pi_jffs2_mount_success=false
pi_failsafe_net_message=false

boot_run_hook preinit_main
```

If you look at /etc/preinit, you can see the default network settings when entering failsafe mode. ㅣㅆda.

```
#!/bin/sh
# Copyright (C) 2006 OpenWrt.org
# Copyright (C) 2010 Vertical Communications

failsafe_netlogin () {
    telnetd -l /bin/login.sh <> /dev/null 2>&1
}

failsafe_shell() {
    lock /tmp/.failsafe
    ash --login
    echo "Please reboot system when done with failsafe network logins"
}

boot_hook_add failsafe failsafe_netlogin
boot_hook_add failsafe failsafe_shell
```

If you look at lib/preinit/99\_10\_failsafe\_login, you can see that Telnetd is running in failsafe mode.

```
...
	return $keypressed
}

failsafe_wait() {
    FAILSAFE=
    pi_failsafe_net_message=true
    preinit_net_echo "Please press button now to enter failsafe"
    pi_failsafe_net_message=false
    fs_wait_for_key f 'to enter failsafe mode' $fs_failsafe_wait_timeout && FAILSAFE=true && export FAILSAFE
}

#boot_hook_add preinit_main failsafe_wait
```

If you trace 99\_10\_failsafe\_login, you can now check whether the actual telnetd execution function is called.

You can see that it is not used in the target device as it is commented out.