---
title: "[PWNABLE] GOT Overwrite"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 이전에 작성한 plt&got를 이용한 공격 기법이다. https://whrdud727.tistory.com/15 [PWNABLE] plt & got ※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 시스템을 공부하는 상황에서 "
date: "2023-10-04"
translation_key: "tistory-e0899e23fb45"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-GOT-Overwrite"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

이전에 작성한 plt&got를 이용한 공격 기법이다.

[https://whrdud727.tistory.com/15](https://whrdud727.tistory.com/15)

 [\[PWNABLE\] plt & got

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 시스템을 공부하는 상황에서 plt와 got에 대해 많이 들어보았을 것이다. plt에는 got의 데이터를 가지고 있고, got에는 함

whrdud727.tistory.com](https://whrdud727.tistory.com/15)

Dynamic 방식의 경우 lazy binding 방식으로 인해 함수를 호출할 때 실제주소를 link하는 것을 살펴보았다.

정상적으로 linking이 되면 plt => got => 실제주소 의 순으로 가리키게 되는데,

이때 got가 가리키는 데이터를 다른 함수의 주소로 덮어버리는 것이 GOT Overwrite이다.

간단한 예제를 가지고 확인해보겠다.

```
#include <stdio.h>

int main(void)
{
        char buf[20];

        gets(buf);
        puts(buf);

        return 0;
}
```

gets함수로 입력한 값을 puts함수로 그대로 출력하는 코드이다.

위 코드를 이용하여 /bin/sh를 실행시켜보겠다.

우선 입력한 값을 그대로 출력한다는 점에서 /bin/sh를 입력하면 된다는 것은 생각할 수 있을 것이다.

인자로 전달될 값은 입력했는데 셸을 실행시킬 system이나 execve함수는 어떻게 해야할까??

정답은 puts함수의 got를 system함수의 주소로 덮어씌우는 것이다.

위 코드의 함수들을 보면 아래와 같이 gets@plt, puts@plt가 있는 것을 볼 수 있다.

![](/assets/images/tistory/tistory-e0899e23fb45/001.png)

우리가 알아야 하는 것은 got인데 왜 plt를 먼저 확인하는지 궁금할 수도 있다.

몇번 언급했지만 plt에는 got의 데이터를 가지고 있다.

즉, 해당 plt를 뜯어보면 got를 얻을 수 있다.

![](/assets/images/tistory/tistory-e0899e23fb45/002.png)

puts@plt = 0x08049060을 이용하여 puts@got인 0x804c008을 구했다.

이제 system 함수를 구해야 하는데 해당 코드를 보면 system함수에 대한 선언이 되어있지 않았다.

그렇다면 파일이 실행되고 공유 라이브러리가 linking이 된 이후를 노려야 한다.

linking이 되면 gdb에서 검색을 하면 공유 라이브러리도 참조를 하기 때문에 system의 실제주소를 구할 수 있다.

![](/assets/images/tistory/tistory-e0899e23fb45/003.png)

이제 puts@got를 system@add로 설정해 보겠다.

![](/assets/images/tistory/tistory-e0899e23fb45/004.png)

set명령어를 사용하면 값을 덮어쓸 수 있다.

이렇게 한 다음 gets의 입력에 '/bin/sh'만 입력하면 셸이 실행되는 것을 볼 수 있다.

![](/assets/images/tistory/tistory-e0899e23fb45/005.png)

실제 ctf나 그런 환경에서는 이런 방법을 사용할 수 없다.

그런 상황에서는 rtl, rop 등의 기법을 이용해 체인을 구성하여 got overwrite를 해야한다.

즉, got overwrite는 앞으로 다룰 기법에서 자주 사용되기 때문에 이해하고 넘어가야 한다.
