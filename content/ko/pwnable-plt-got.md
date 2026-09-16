---
title: "[PWNABLE] plt & got"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 시스템을 공부하는 상황에서 plt와 got에 대해 많이 들어보았을 것이다. plt에는 got의 데이터를 가지고 있고, got에는 함수의 실제 주소에 대한 데이터를 가지고 있다. 이 정도로 알고 있을 것이다. 먼저 개념을 살펴보면 PLT (Proced"
date: "2023-10-04"
translation_key: "tistory-218fb7259047"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-plt-got"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

시스템을 공부하는 상황에서 plt와 got에 대해 많이 들어보았을 것이다.

plt에는 got의 데이터를 가지고 있고, got에는 함수의 실제 주소에 대한 데이터를 가지고 있다.

이 정도로 알고 있을 것이다.

먼저 개념을 살펴보면

**PLT (Procedure Linkage Table)** : 외부 프로시저를 연결해주는 테이블로 라이브러리에 있는 프로시저를 호출해 사용할 수 있다.

**GOT (Global Offset Table)** : PLT가 참조하는 테이블로 프로시저의 주소가 저장되어 있다.

해당 개념을 이해하기 위해서는 static 과 dynamic linking에 대해 알아야 한다.

**linking** : 각종 함수들의 구현 코드들이 모여있는 라이브러리를 바이너리 파일과 연결해주는 작업을 의미한다.

* * *

**static** 방식의 경우에는 plt와 got를 필요로 하지 않는다.

파일 생성 시 라이브러리의 내용을 파일에 포함되기 때문에 함수 호출 간의 추가적인 linking방식이 필요하지 않게 된다.

이 방식의 단점으로는 공유 라이브러리 파일의 내용이 수정되면 해당 바이너리 파일에 linking이 안되기 때문에 새로 컴파일을 해주어야 하고, 파일 자체의 용량이 커진다는 점이 있다.

![](/assets/images/tistory/tistory-218fb7259047/001.png)

static 방식에서 **now binding** 을 사용한다.

: 바이너리 파일이 시작될 때 모든 심볼의 주소를 linking하는 방식

* * *

**dynamic** 방식은 static과 달리 공유 라이브러리와의 linking을 이용한다.

바이너리 파일이 실행이 되면 라이브러리를 메모리에 매핑한다.

그리고 함수를 호출하는 과정에서 linking이 일어나는데

이 과정으로 인해 라이브러리 파일을 수정해도 새로 컴파일 할 이유가 없다.

![](/assets/images/tistory/tistory-218fb7259047/002.png)

dynamic 방식에서 사용하는 방식이 **lazy binding**이다.

: 함수를 호출하는 시점에서 해당 심볼의 주소를 찾아서 linking하는 방식

lazy binding 방식을 살펴보겠다.

![](/assets/images/tistory/tistory-218fb7259047/003.png)

함수를 호출하고 step into를 활용하여 흐름을 추적하다보면 위의 함수에 접근할 수 있다.

\_dl\_runtime\_resolve\_xsavec함수가 실행되기 전과 후의 got 상태를 살펴보겠다.

![](/assets/images/tistory/tistory-218fb7259047/004.png)

호출되기 전에는 함수의 실제주소가 아닌 값이 들어있다.

resolve함수가 처리된 이후의 모습이다.

![](/assets/images/tistory/tistory-218fb7259047/005.png)

전과는 다른 주소가 들어가 있는 것을 볼 수 있다.

해당 주소는 라이브러리 파일을 참조하여 setvbuf라는 함수의 실제 주소를 가져온 것이다.

![](/assets/images/tistory/tistory-218fb7259047/006.png)

가져온 주소가 libc 영역인 것을 확인할 수 있다.
