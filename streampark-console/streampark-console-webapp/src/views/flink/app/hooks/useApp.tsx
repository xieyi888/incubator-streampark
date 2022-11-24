/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Alert, Form, Input, Tag } from 'ant-design-vue';
import { h, onMounted, reactive, ref, unref, VNode } from 'vue';
import { handleAppBuildStatueText } from '../utils';
import { fetchCopy, fetchForcedStop, fetchMapping } from '/@/api/flink/app/app';
import { fetchBuild, fetchBuildDetail } from '/@/api/flink/app/flinkBuild';
import { fetchLatest, fetchSavePonitHistory } from '/@/api/flink/app/savepoint';
import { fetchAppOwners } from '/@/api/system/user';
import { SvgIcon } from '/@/components/Icon';
import { AppStateEnum, ExecModeEnum, OptionStateEnum } from '/@/enums/flinkEnum';
import { useI18n } from '/@/hooks/web/useI18n';
import { useMessage } from '/@/hooks/web/useMessage';

export const useFlinkApplication = (openStartModal: Fn) => {
  const { t } = useI18n();
  const { Swal, createConfirm, createMessage, createWarningModal } = useMessage();
  const users = ref<Recordable>([]);
  const appBuildDetail = reactive<Recordable>({});
  const historySavePoint = ref<any>([]);
  const optionApps = {
    starting: new Map(),
    stopping: new Map(),
    launch: new Map(),
  };

  /* check */
  function handleCheckLaunchApp(app: Recordable) {
    if (app['appControl']['allowBuild'] === true) {
      handleLaunchApp(app, false);
    } else {
      createWarningModal({
        title: 'WARNING',
        content: `
          <p class="pt-10px">${t('flink.app.launch.launchTitle')}</p>
          <p>${t('flink.app.launch.launchDesc')}</p>
        `,
        okType: 'danger',
        onOk: () => handleLaunchApp(app, true),
      });
    }
  }

  /* Launch App */
  async function handleLaunchApp(app: Recordable, force: boolean) {
    const { data } = await fetchBuild({
      appId: app.id,
      forceBuild: force,
    });
    if (!data.data) {
      Swal.fire(
        'Failed',
        t('flink.app.launch.launchFail') +
          '' +
          (data.message || '').replaceAll(/\[StreamPark]/g, ''),
        'error',
      );
    } else {
      Swal.fire({
        icon: 'success',
        title: t('flink.app.launch.launching'),
        showConfirmButton: false,
        timer: 2000,
      });
    }
  }

  /* start application */
  function handleAppCheckStart(app: Recordable) {
    // when then app is building, show forced starting modal
    if (app['appControl']['allowStart'] === false) {
      handleFetchBuildDetail(app);
      createWarningModal({
        title: 'WARNING',
        content: () => {
          const content: Array<VNode> = [];
          if (appBuildDetail.pipeline == null) {
            content.push(
              h('p', { class: 'pt-10px' }, 'No build record exists for the current application.'),
            );
          } else {
            content.push(
              h('p', { class: 'pt-10px' }, [
                'The current build state of the application is',
                h(
                  Tag,
                  { color: 'orange' },
                  handleAppBuildStatueText(appBuildDetail.pipeline.pipeStatus),
                ),
              ]),
            );
          }
          content.push(h('p', null, 'Are you sure to force the application to run?'));
          return content;
        },
        okType: 'danger',
        onOk: () => {
          handleStart(app);
          return Promise.resolve(true);
        },
      });
    } else {
      handleStart(app);
    }
  }

  async function handleStart(app: Recordable) {
    if (app.flinkVersion == null) {
      Swal.fire('Failed', 'please set flink version first.', 'error');
    } else {
      if (!optionApps.starting.get(app.id) || app['optionState'] === OptionStateEnum.NONE) {
        const res = await fetchLatest({
          appId: app.id,
        });
        if (!res) {
          const resp = await fetchSavePonitHistory({
            appId: app.id,
            pageNum: 1,
            pageSize: 9999,
          });
          historySavePoint.value = resp.records.filter((x: Recordable) => x.path);
        }
        openStartModal(true, {
          latestSavePoint: res,
          executionMode: app.executionMode,
          application: app,
          historySavePoint: historySavePoint.value,
        });
      }
    }
  }

  async function handleFetchBuildDetail(app: Recordable) {
    const res = await fetchBuildDetail({
      appId: app.id,
    });
    appBuildDetail.pipeline = res.pipeline;
    appBuildDetail.docker = res.docker;
  }

  function handleCanStop(app: Recordable) {
    const optionTime = new Date(app['optionTime']).getTime();
    const nowTime = new Date().getTime();
    if (nowTime - optionTime >= 60 * 1000) {
      const state = app['optionState'];
      if (state === OptionStateEnum.NONE) {
        return (
          [
            AppStateEnum.INITIALIZING,
            AppStateEnum.STARTING,
            AppStateEnum.RESTARTING,
            AppStateEnum.CANCELLING,
            AppStateEnum.RECONCILING,
            AppStateEnum.MAPPING,
          ].includes(app.state) || false
        );
      }
      return true;
    }
    return false;
  }
  function handleForcedStop(app: Recordable) {
    let option = 'starting';
    const optionState = app['optionState'];
    const stateMap = {
      [AppStateEnum.STARTING]: 'starting',
      [AppStateEnum.RESTARTING]: 'restarting',
      [AppStateEnum.CANCELLING]: 'cancelling',
    };
    const optionStateMap = {
      [OptionStateEnum.LAUNCHING]: 'launching',
      [OptionStateEnum.CANCELLING]: 'cancelling',
      [OptionStateEnum.STARTING]: 'starting',
      [OptionStateEnum.SAVEPOINTING]: 'savePointing',
    };
    if (optionState === OptionStateEnum.NONE) {
      option = stateMap[app.state];
    } else {
      option = optionStateMap[optionState];
    }
    Swal.fire({
      title: 'Are you sure?',
      text: `current job is ${option}, are you sure forced stop?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, forced stop!',
      denyButtonText: `No, cancel`,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
    }).then(async (result) => {
      if (result.isConfirmed) {
        Swal.fire('forced stopping', '', 'success');
        const res = await fetchForcedStop({
          id: app.id,
        });
        if (res) {
          createMessage.success('forced stopping');
        }
        return Promise.resolve();
      }
    });
  }

  /* copy application */
  function handleCopy(item) {
    const validateStatus = ref<'' | 'error' | 'validating' | 'success' | 'warning'>('');
    let help = '';
    let copyAppName: string | undefined = '';
    createConfirm({
      width: '600px',
      title: () => [
        h(SvgIcon, {
          name: 'copy',
          style: { color: 'red', display: 'inline-block', marginRight: '10px' },
        }),
        'Copy Application',
      ],
      content: () => {
        return (
          <Form class="!pt-30px">
            <Form.Item
              label="Application Name"
              labelCol={{ lg: { span: 7 }, sm: { span: 7 } }}
              wrapperCol={{ lg: { span: 16 }, sm: { span: 4 } }}
              validateStatus={unref(validateStatus)}
              help={help}
              rules={[{ required: true }]}
            >
              <Input
                type="text"
                placeholder="New Application Name"
                onInput={(e) => {
                  copyAppName = e.target.value;
                }}
              ></Input>
            </Form.Item>
          </Form>
        );
      },
      okText: 'Apply',
      cancelText: 'Close',
      onOk: async () => {
        if (!copyAppName) {
          validateStatus.value = 'error';
          help = 'Sorry, Application Name cannot be empty';
          console.log(validateStatus);
          return Promise.reject('error');
        }
        try {
          const { data } = await fetchCopy({
            id: item.id,
            jobName: copyAppName,
          });
          const status = data.status || 'error';
          if (status === 'success') {
            Swal.fire({
              icon: 'success',
              title: 'copy successful',
              timer: 1500,
            });
          }
        } catch (error: any) {
          if (error?.response?.data?.message) {
            createMessage.error(
              error.response.data.message
                .replaceAll(/\[StreamPark\]/g, '')
                .replaceAll(/\[StreamPark\]/g, '') || 'copy failed',
            );
          }
          return Promise.reject();
        }
      },
    });
  }

  /* mapping */
  function handleMapping(app) {
    const mappingRef = ref();
    const formValue = reactive<any>({});
    createConfirm({
      width: '600px',
      title: () => [
        h(SvgIcon, {
          name: 'mapping',
          style: { color: 'green', display: 'inline-block', marginRight: '10px' },
        }),
        'Mapping Application',
      ],
      content: () => {
        return (
          <Form
            class="!pt-40px"
            ref={mappingRef}
            name="mappingForm"
            labelCol={{ lg: { span: 7 }, sm: { span: 7 } }}
            wrapperCol={{ lg: { span: 16 }, sm: { span: 4 } }}
            v-model:model={formValue}
          >
            <Form.Item label="Application Name">
              <Alert message={app.jobName} type="info" />
            </Form.Item>
            {[
              ExecModeEnum.YARN_PER_JOB,
              ExecModeEnum.YARN_SESSION,
              ExecModeEnum.YARN_APPLICATION,
            ].includes(app.executionMode) && (
              <Form.Item
                label="YARN Application Id"
                name="appId"
                rules={[{ required: true, message: 'YARN ApplicationId is required' }]}
              >
                <Input type="text" placeholder="ApplicationId" v-model:value={formValue.appId} />
              </Form.Item>
            )}
            <Form.Item
              label="JobId"
              name="jobId"
              rules={[{ required: true, message: 'jobId is required' }]}
            >
              <Input type="text" placeholder="JobId" v-model:value={formValue.jobId} />
            </Form.Item>
          </Form>
        );
      },
      okText: 'Apply',
      cancelText: 'Close',
      onOk: async () => {
        try {
          await mappingRef.value.validate();
          await fetchMapping({
            id: app.id,
            appId: formValue.appId,
            jobId: formValue.jobId,
          });
          Swal.fire({
            icon: 'success',
            title: 'The current job is mapping',
            showConfirmButton: false,
            timer: 2000,
          });
          return Promise.resolve();
        } catch (error) {
          return Promise.reject(error);
        }
      },
    });
  }

  onMounted(() => {
    fetchAppOwners({}).then((res) => {
      users.value = res;
    });
  });

  return {
    handleCheckLaunchApp,
    handleAppCheckStart,
    handleCanStop,
    handleForcedStop,
    handleCopy,
    handleMapping,
    users,
  };
};
