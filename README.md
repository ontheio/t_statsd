t_statsd
========

https://t.onthe.io http backend for statsd.

How to use:
- Create t.onthe.io account.
- Obtain API id and key.
- Download this t.js backend and place it under statsd/backends folder.
- edit statsd/config.js:
```
{
  port: 8125
  , flushInterval: 1000
  , backends: ['./backends/t']
  , t: {id: 1, key: 'asdkjasd'}
}
```

- Restart statsd.
